/**
 * PredictionMarket.ts - Binary prediction market contract (OPTIMIZED FOR 8 FIELD LIMIT)
 *
 * Implements a YES/NO prediction market with:
 * - Linear AMM pricing (1:1 for MVP)
 * - Time-based locking (30 min before end)
 * - Doot Oracle settlement
 * - Proportional payouts with fees
 * - Offchain position tracking
 *
 * State usage: 4 on-chain Fields + 4 for offchainState = 8 Fields total (AT LIMIT)
 *
 * CRITICAL: Market config (asset, threshold, creator) stored in offchain state to save Fields
 * endTime kept on-chain for reliable time-based checks without offchain state reads
 */

import {
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Field,
  UInt64,
  Bool,
  Experimental,
  Permissions,
  AccountUpdate,
  Provable,
  Struct,
} from 'o1js';

const { OffchainState } = Experimental;

import {
  Position,
  INITIAL_POOL_AMOUNT,
  CREATOR_DEPOSIT,
  SETTLEMENT_REWARD,
  OUTCOME,
  MINIMUM_BET,
  MIN_MARKET_DURATION_MS,
  MAX_MARKET_DURATION_MS,
  MARKET_LOCKOUT_MS,
} from '../types/index.js';
import { MarketMath, safeAdd } from '../utils/MarketMath.js';
import { Doot, DootOracleClient } from '../utils/DootOracle.js';

/**
 * MarketConfig - Stored in offchain state to save on-chain Fields
 */
export class MarketConfig extends Struct({
  assetIndex: Field,        // 0-9 (MINA, BTC, ETH...)
  priceThreshold: Field,    // Price threshold in Doot format
  endTimestamp: UInt64,     // Market end time
  creator: PublicKey,       // Market creator
  burnAddress: PublicKey,   // Burn address (40% of fees)
  registryAddress: PublicKey, // MarketRegistry treasury (40% of fees)
}) {}

/**
 * Offchain state for PredictionMarket
 *
 * Note: config is stored as a Map with single key Field(0) for compatibility
 */
export const predictionMarketOffchainState = OffchainState({
  config: OffchainState.Map(Field, MarketConfig),
  positions: OffchainState.Map(PublicKey, Position),
});

export class PredictionMarketOffchainStateProof extends predictionMarketOffchainState.Proof {}

/**
 * PredictionMarket Contract (FIELD-OPTIMIZED)
 *
 * On-chain state: 8 Fields (AT LIMIT)
 * - yesPool (UInt64 = 1 Field)
 * - noPool (UInt64 = 1 Field)
 * - status (Field = 1 Field): 0=PENDING, 1=YES won, 2=NO won
 * - endTime (UInt64 = 1 Field): Market end timestamp in milliseconds
 * - offchainStateCommitments (4 Fields)
 *
 * Total: 8 Fields (exactly at Mina's 8 Field limit)
 */
export class PredictionMarket extends SmartContract {
  /**
   * yesPool: Total amount in YES pool (nanomina)
   */
  @state(UInt64) yesPool = State<UInt64>();

  /**
   * noPool: Total amount in NO pool (nanomina)
   */
  @state(UInt64) noPool = State<UInt64>();

  /**
   * status: Combined settlement status
   * 0 = ACTIVE (accepting bets)
   * 1 = SETTLED_YES (YES won)
   * 2 = SETTLED_NO (NO won)
   */
  @state(Field) status = State<Field>();

  /**
   * endTime: Market end time in ms (on-chain for reliable time checks)
   */
  @state(UInt64) endTime = State<UInt64>();

  /**
   * offchainStateCommitments: Merkle root for offchain data
   */
  @state(OffchainState.Commitments) offchainStateCommitments =
    predictionMarketOffchainState.emptyCommitments();

  offchainState = predictionMarketOffchainState.init(this);

  async deploy() {
    await super.deploy();
    this.account.permissions.set({
      ...Permissions.default(),
      setPermissions: Permissions.impossible(),
      access: Permissions.none(),
    });
  }

  /**
   * Initialize market
   *
   * Sets up market with config in offchain state and initial liquidity on-chain.
   * Creator sends 10 MINA which seeds 5 MINA YES + 5 MINA NO pools.
   */
  @method
  async initialize(
    assetIdx: Field,
    threshold: Field,
    endTime: UInt64,
    creatorAddress: PublicKey,
    burnAddress: PublicKey,
    registryAddress: PublicKey
  ) {
    // Ensure offchain state has contract instance
    this.offchainState.setContractInstance(this);
    // Verify first initialization (status should be 0)
    this.status.getAndRequireEquals().assertEquals(Field(0));

    // Validate parameters
    assetIdx.assertLessThanOrEqual(Field(9));
    assetIdx.assertGreaterThanOrEqual(Field(0));
    threshold.assertGreaterThan(Field(0));

    // Enforce duration bounds (1-7 days = 86400000ms to 604800000ms)
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const duration = endTime.sub(currentTime);
    const minDuration = UInt64.from(MIN_MARKET_DURATION_MS); // 1 day
    const maxDuration = UInt64.from(MAX_MARKET_DURATION_MS); // 7 days
    duration.assertGreaterThanOrEqual(minDuration, 'Market duration too short (min 1 day)');
    duration.assertLessThanOrEqual(maxDuration, 'Market duration too long (max 7 days)');

    // Initialize on-chain pools
    this.yesPool.set(INITIAL_POOL_AMOUNT);
    this.noPool.set(INITIAL_POOL_AMOUNT);
    this.status.set(OUTCOME.PENDING); // 0 = active
    this.endTime.set(endTime);

    // Store config in offchain state
    const config = new MarketConfig({
      assetIndex: assetIdx,
      priceThreshold: threshold,
      endTimestamp: endTime,
      creator: creatorAddress,
      burnAddress: burnAddress,
      registryAddress: registryAddress,
    });

    const currentConfig = await this.offchainState.fields.config.get(Field(0));
    this.offchainState.fields.config.update(Field(0), {
      from: currentConfig,
      to: config,
    });

    // Creator deposits 10 MINA
    const creatorUpdate = AccountUpdate.createSigned(creatorAddress);
    creatorUpdate.send({ to: this.address, amount: CREATOR_DEPOSIT });
  }

  /**
   * Buy YES tokens
   */
  @method
  async buyYes(amount: UInt64) {
    this.offchainState.setContractInstance(this);
    // Verify market is active
    this.status.getAndRequireEquals().assertEquals(OUTCOME.PENDING);

    // Verify not in lockout period
    await this.verifyBettingAllowed();

    // Enforce minimum bet
    amount.assertGreaterThanOrEqual(MINIMUM_BET);

    // Get current pool state
    const yesPool = this.yesPool.getAndRequireEquals();

    // Calculate tokens using 1:1 linear pricing
    // AMM formula exists in MarketMath but reverted due to payout math mismatch
    // TODO: Implement token supply tracking before re-enabling AMM
    const tokensReceived = amount;

    // Update YES pool after calculation
    const newYesPool = safeAdd(yesPool, amount);
    this.yesPool.set(newYesPool);

    // Update user position in offchain state
    const sender = this.sender.getAndRequireSignature();
    const currentPosition = await this.offchainState.fields.positions.get(sender);
    const existingPosition = currentPosition.orElse(Position.empty());

    const updatedPosition = new Position({
      yesAmount: safeAdd(existingPosition.yesAmount, tokensReceived),
      noAmount: existingPosition.noAmount,
      claimed: existingPosition.claimed,
    });

    this.offchainState.fields.positions.update(sender, {
      from: currentPosition,
      to: updatedPosition,
    });

    // Transfer MINA from user
    const userUpdate = AccountUpdate.createSigned(sender);
    userUpdate.send({ to: this.address, amount });
  }

  /**
   * Buy NO tokens
   */
  @method
  async buyNo(amount: UInt64) {
    this.offchainState.setContractInstance(this);
    // Verify market is active
    this.status.getAndRequireEquals().assertEquals(OUTCOME.PENDING);

    // Verify not in lockout period
    await this.verifyBettingAllowed();

    // Enforce minimum bet
    amount.assertGreaterThanOrEqual(MINIMUM_BET);

    // Get current pool state
    const noPool = this.noPool.getAndRequireEquals();

    // Calculate tokens using 1:1 linear pricing
    // AMM formula exists in MarketMath but reverted due to payout math mismatch
    // TODO: Implement token supply tracking before re-enabling AMM
    const tokensReceived = amount;

    // Update NO pool after calculation
    const newNoPool = safeAdd(noPool, amount);
    this.noPool.set(newNoPool);

    // Update user position in offchain state
    const sender = this.sender.getAndRequireSignature();
    const currentPosition = await this.offchainState.fields.positions.get(sender);
    const existingPosition = currentPosition.orElse(Position.empty());

    const updatedPosition = new Position({
      yesAmount: existingPosition.yesAmount,
      noAmount: safeAdd(existingPosition.noAmount, tokensReceived),
      claimed: existingPosition.claimed,
    });

    this.offchainState.fields.positions.update(sender, {
      from: currentPosition,
      to: updatedPosition,
    });

    // Transfer MINA from user
    const userUpdate = AccountUpdate.createSigned(sender);
    userUpdate.send({ to: this.address, amount });
  }

  /**
   * Settle market with Doot Oracle
   */
  @method
  async settleWithDoot(dootAddress: PublicKey) {
    this.offchainState.setContractInstance(this);
    // Verify not already settled
    const currentStatus = this.status.getAndRequireEquals();
    currentStatus.assertEquals(OUTCOME.PENDING);

    // Enforce market has ended before settlement
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTs = this.endTime.getAndRequireEquals();
    currentTime.assertGreaterThanOrEqual(endTs, 'Market has not ended yet');

    // Fetch price from Doot
    const dootContract = new Doot(dootAddress);
    const cfg = (await this.offchainState.fields.config.get(Field(0))).value;
    const finalPrice = await DootOracleClient.getAssetPrice(dootContract, cfg.assetIndex);

    // Determine outcome
    const yesWins = finalPrice.greaterThanOrEqual(cfg.priceThreshold);
    const outcome = Provable.if(yesWins, OUTCOME.YES, OUTCOME.NO);

    // Update status
    this.status.set(outcome);

    // Reward caller (9 MINA per spec)
    const caller = this.sender.getAndRequireSignature();
    const contractUpdate = AccountUpdate.create(this.address);
    contractUpdate.send({ to: caller, amount: SETTLEMENT_REWARD });
  }

  /**
   * Settle market with manual price (for testing)
   */
  @method
  async settleMarket(finalPrice: Field, settlementTimestamp: UInt64) {
    this.offchainState.setContractInstance(this);
    // Verify not already settled
    const currentStatus = this.status.getAndRequireEquals();
    currentStatus.assertEquals(OUTCOME.PENDING);

    // Verify we're past end time
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTs = this.endTime.getAndRequireEquals();
    currentTime.assertGreaterThanOrEqual(endTs);

    // Verify settlement timestamp
    settlementTimestamp.assertGreaterThan(endTs);

    // Determine outcome
    const cfg2 = (await this.offchainState.fields.config.get(Field(0))).value;
    const yesWins = finalPrice.greaterThanOrEqual(cfg2.priceThreshold);
    const outcome = Provable.if(yesWins, OUTCOME.YES, OUTCOME.NO);

    // Update status
    this.status.set(outcome);

    // Reward caller (9 MINA per spec)
    const caller = this.sender.getAndRequireSignature();
    const contractUpdate = AccountUpdate.create(this.address);
    contractUpdate.send({ to: caller, amount: SETTLEMENT_REWARD });
  }

  /**
   * Claim winnings
   */
  @method
  async claim() {
    this.offchainState.setContractInstance(this);
    // Verify market is settled
    const currentStatus = this.status.getAndRequireEquals();
    currentStatus.equals(OUTCOME.PENDING).assertFalse();

    // Get user position
    const sender = this.sender.getAndRequireSignature();
    const positionOption = await this.offchainState.fields.positions.get(sender);
    const position = positionOption.value;

    // Verify not already claimed
    position.claimed.assertFalse();

    // Get pools
    const yesPool = this.yesPool.getAndRequireEquals();
    const noPool = this.noPool.getAndRequireEquals();

    // Determine winner
    const isYesWinner = currentStatus.equals(OUTCOME.YES);

    // Calculate payout
    const totalPool = safeAdd(yesPool, noPool);
    const winningPool = Provable.if(isYesWinner, yesPool, noPool);
    const userWinningAmount = Provable.if(isYesWinner, position.yesAmount, position.noAmount);

    // Verify user has winning position
    userWinningAmount.assertGreaterThan(UInt64.zero);

    // Calculate proportional payout with fee
    const grossPayout = MarketMath.calculateProportionalPayout(
      userWinningAmount,
      winningPool,
      totalPool
    );
    const netPayout = MarketMath.calculateNetClaim(grossPayout);

    // Calculate fee distribution (creator share)
    const totalFee = grossPayout.sub(netPayout);
    const feeSplit = MarketMath.distributeFees(totalFee);

    // Mark as claimed
    const updatedPosition = new Position({
      yesAmount: position.yesAmount,
      noAmount: position.noAmount,
      claimed: Bool(true),
    });

    this.offchainState.fields.positions.update(sender, {
      from: positionOption,
      to: updatedPosition,
    });

    // Transfer payout to user
    const contractUpdate = AccountUpdate.create(this.address);
    contractUpdate.send({ to: sender, amount: netPayout });

    // Get config for fee distribution addresses
    const configOption2 = await this.offchainState.fields.config.get(Field(0));
    const config = configOption2.value;

    // Pay creator share (20% of fees)
    const creatorUpdate = AccountUpdate.create(this.address);
    creatorUpdate.send({ to: config.creator, amount: feeSplit.creator });

    // Pay burn share (40% of fees) to burn address
    const burnUpdate = AccountUpdate.create(this.address);
    burnUpdate.send({ to: config.burnAddress, amount: feeSplit.burn });

    // Pay registry treasury share (40% of fees) to MarketRegistry
    const registryUpdate = AccountUpdate.create(this.address);
    registryUpdate.send({ to: config.registryAddress, amount: feeSplit.platform });
  }

  /**
   * Settle offchain state
   */
  @method
  async settle(proof: PredictionMarketOffchainStateProof) {
    this.offchainState.setContractInstance(this);
    await this.offchainState.settle(proof);
  }

  /**
   * Verify betting is allowed (not in lockout period)
   */
  private async verifyBettingAllowed() {
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTs = this.endTime.getAndRequireEquals();
    const lockoutStart = endTs.sub(MARKET_LOCKOUT_MS); // 30 min in ms

    currentTime.assertLessThan(lockoutStart);
  }

  /**
   * Get user position
   */
  @method.returns(Position)
  async getPosition(user: PublicKey): Promise<Position> {
    this.offchainState.setContractInstance(this);
    const positionOption = await this.offchainState.fields.positions.get(user);
    return positionOption.orElse(Position.empty());
  }
}
