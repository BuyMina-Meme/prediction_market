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
  BASE_FEE_BPS,
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
  startTimestamp: UInt64,   // Market start time (for τ normalization)
  creator: PublicKey,       // Market creator
  burnAddress: PublicKey,   // Burn address (50% of fees in V1)
  registryAddress: PublicKey, // MarketRegistry treasury (50% of fees in V1)
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
   * V1 MVP: Sets up market with config in offchain state and 5 MINA per pool.
   * Creator sends 10 MINA total (protocol-operated markets).
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

    // Capture start time for τ normalization (V1)
    const startTime = this.network.timestamp.getAndRequireEquals();

    // Enforce duration bounds (V1: 1-30 days)
    const duration = endTime.sub(startTime);
    const minDuration = UInt64.from(MIN_MARKET_DURATION_MS); // 1 day
    const maxDuration = UInt64.from(MAX_MARKET_DURATION_MS); // 30 days
    duration.assertGreaterThanOrEqual(minDuration, 'Market duration too short (min 1 day)');
    duration.assertLessThanOrEqual(maxDuration, 'Market duration too long (max 30 days)');

    // Initialize on-chain pools (V1: 5 MINA each)
    this.yesPool.set(INITIAL_POOL_AMOUNT);
    this.noPool.set(INITIAL_POOL_AMOUNT);
    this.status.set(OUTCOME.PENDING); // 0 = active
    this.endTime.set(endTime);

    // Store config in offchain state (V1: includes startTimestamp)
    const config = new MarketConfig({
      assetIndex: assetIdx,
      priceThreshold: threshold,
      endTimestamp: endTime,
      startTimestamp: startTime,
      creator: creatorAddress,
      burnAddress: burnAddress,
      registryAddress: registryAddress,
    });

    const currentConfig = await this.offchainState.fields.config.get(Field(0));
    this.offchainState.fields.config.update(Field(0), {
      from: currentConfig,
      to: config,
    });

    // Creator deposits 10 MINA (protocol-operated)
    const creatorUpdate = AccountUpdate.createSigned(creatorAddress);
    creatorUpdate.send({ to: this.address, amount: CREATOR_DEPOSIT });
  }

  /**
   * Buy YES tokens (V1 with bet-time fees)
   *
   * Fee structure:
   * - Base fee: 0.2% on all bets
   * - Late fee: 0-20% based on time remaining + pool imbalance
   * - Shares minted: 1:1 with net amount (after fees)
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

    const sender = this.sender.getAndRequireSignature();

    // Get market config for fee distribution addresses and timing
    const configOption = await this.offchainState.fields.config.get(Field(0));
    const config = configOption.value;
    Provable.asProver(() => {
      console.log('buyYes treasury', config.registryAddress.toBase58());
      console.log('buyYes burn', config.burnAddress.toBase58());
    });

    // Calculate time remaining for fee calculation
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTime = this.endTime.getAndRequireEquals();
    const remaining = endTime.sub(currentTime);
    const totalDuration = endTime.sub(config.startTimestamp);

    // Get current pool state (before update)
    const yesPool = this.yesPool.getAndRequireEquals();
    const noPool = this.noPool.getAndRequireEquals();

    // === V1 FEE CALCULATION ===

    // 1. Base fee (0.2%)
    Provable.asProver(() => {
      console.log('buyYes amount', amount.toBigInt().toString(), 'BASE_FEE_BPS', BASE_FEE_BPS.toBigInt().toString());
    });
    const baseFee = amount.mul(BASE_FEE_BPS).div(UInt64.from(10000));
    const netAfterBase = amount.sub(baseFee);

    // 2. Late fee (0-20% on net after base fee)
    const lateFeeBps = this.calculateLateFee(remaining, totalDuration, yesPool, noPool);
    const lateFee = netAfterBase.mul(lateFeeBps).div(UInt64.from(10000));
    const finalNet = netAfterBase.sub(lateFee);
    Provable.asProver(() => {
      console.log('buyYes lateFeeBps', lateFeeBps.toBigInt().toString());
    });

    // 3. Total fees to distribute
    const totalFees = baseFee.add(lateFee);

    // === FEE SPLIT (50% treasury, 50% burn) ===
    const treasuryShare = totalFees.div(UInt64.from(2));
    const burnShare = totalFees.sub(treasuryShare);
    Provable.asProver(() => {
      console.log('buyNo totalFees', totalFees.toBigInt().toString());
    });
    Provable.asProver(() => {
      console.log('buyYes totalFees', totalFees.toBigInt().toString());
    });

    // === FUNDS FLOW ===
    // Caller pays `amount` via a signed AccountUpdate before invoking this method.
    // Credit the contract balance, then send fees to treasury and burn.
    this.balance.addInPlace(amount);
    this.send({ to: config.registryAddress, amount: treasuryShare });
    this.send({ to: config.burnAddress, amount: burnShare });

    // Balance proof: user AU (-amount) + contract AU (+amount - fees) = +finalNet

    // === SHARE ISSUANCE (1:1 with final net amount) ===
    const sharesReceived = finalNet;

    // === POOL UPDATE ===
    const newYesPool = safeAdd(yesPool, finalNet);
    this.yesPool.set(newYesPool);

    // === USER POSITION UPDATE ===
    const currentPosition = await this.offchainState.fields.positions.get(sender);
    const existingPosition = currentPosition.orElse(Position.empty());

    const updatedPosition = new Position({
      yesAmount: safeAdd(existingPosition.yesAmount, sharesReceived),
      noAmount: existingPosition.noAmount,
      claimed: existingPosition.claimed,
      hasSwitched: existingPosition.hasSwitched,
    });

    this.offchainState.fields.positions.update(sender, {
      from: currentPosition,
      to: updatedPosition,
    });
  }

  /**
   * Buy NO tokens (V1 with bet-time fees)
   *
   * Fee structure:
   * - Base fee: 0.2% on all bets
   * - Late fee: 0-20% based on time remaining + pool imbalance
   * - Shares minted: 1:1 with net amount (after fees)
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

    const sender = this.sender.getAndRequireSignature();

    // Get market config for fee distribution addresses and timing
    const configOption = await this.offchainState.fields.config.get(Field(0));
    const config = configOption.value;
    Provable.asProver(() => {
      console.log('buyNo treasury', config.registryAddress.toBase58());
      console.log('buyNo burn', config.burnAddress.toBase58());
    });

    // Calculate time remaining for fee calculation
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTime = this.endTime.getAndRequireEquals();
    const remaining = endTime.sub(currentTime);
    const totalDuration = endTime.sub(config.startTimestamp);

    // Get current pool state (before update)
    const yesPool = this.yesPool.getAndRequireEquals();
    const noPool = this.noPool.getAndRequireEquals();

    // === V1 FEE CALCULATION ===

    // 1. Base fee (0.2%)
    Provable.asProver(() => {
      console.log('buyNo amount', amount.toBigInt().toString(), 'BASE_FEE_BPS', BASE_FEE_BPS.toBigInt().toString());
    });
    const baseFee = amount.mul(BASE_FEE_BPS).div(UInt64.from(10000));
    const netAfterBase = amount.sub(baseFee);

    // 2. Late fee (0-20% on net after base fee)
    const lateFeeBps = this.calculateLateFee(remaining, totalDuration, yesPool, noPool);
    const lateFee = netAfterBase.mul(lateFeeBps).div(UInt64.from(10000));
    const finalNet = netAfterBase.sub(lateFee);
    Provable.asProver(() => {
      console.log('buyNo lateFeeBps', lateFeeBps.toBigInt().toString());
    });

    // 3. Total fees to distribute
    const totalFees = baseFee.add(lateFee);

    // === FEE SPLIT (50% treasury, 50% burn) ===
    const treasuryShare = totalFees.div(UInt64.from(2));
    const burnShare = totalFees.sub(treasuryShare);

    // === FUNDS FLOW ===
    // Caller pays `amount` via a signed AccountUpdate before invoking this method.
    // Credit the contract balance, then send fees to treasury and burn.
    this.balance.addInPlace(amount);
    this.send({ to: config.registryAddress, amount: treasuryShare });
    this.send({ to: config.burnAddress, amount: burnShare });

    // Balance proof identical to buyYes

    // === SHARE ISSUANCE (1:1 with final net amount) ===
    const sharesReceived = finalNet;

    // === POOL UPDATE ===
    const newNoPool = safeAdd(noPool, finalNet);
    this.noPool.set(newNoPool);

    // === USER POSITION UPDATE ===
    const currentPosition = await this.offchainState.fields.positions.get(sender);
    const existingPosition = currentPosition.orElse(Position.empty());

    const updatedPosition = new Position({
      yesAmount: existingPosition.yesAmount,
      noAmount: safeAdd(existingPosition.noAmount, sharesReceived),
      claimed: existingPosition.claimed,
      hasSwitched: existingPosition.hasSwitched,
    });

    this.offchainState.fields.positions.update(sender, {
      from: currentPosition,
      to: updatedPosition,
    });
  }

  /**
   * V1: Switch position from one outcome to another (one-time only)
   *
   * Allows users to switch their position from YES to NO or vice versa.
   * - Can only be used once per user (tracked via hasSwitched flag)
   * - Subject to time cutoff (normalized 1-3h depending on market duration)
   * - Haircut applied: 15% early (τ ≥ 0.50) or 25% late (τ < 0.50)
   * - Haircut distributed: 50% treasury, 50% burn
   * - Pool accounting: losing pool decreases, winning pool increases by net
   *
   * @param amount - Amount of tokens to switch
   * @param toYes - Direction: true = switch to YES, false = switch to NO
   */
  @method
  async switchPosition(amount: UInt64, toYes: Bool) {
    this.offchainState.setContractInstance(this);

    // === VALIDATION: Get config and timing ===
    const configOption = await this.offchainState.fields.config.get(Field(0));
    configOption.isSome.assertTrue('Market config not initialized');
    const config = configOption.value;

    const currentTime = this.network.timestamp.getAndRequireEquals();
    const endTime = this.endTime.getAndRequireEquals();
    const remaining = endTime.sub(currentTime);
    const totalDuration = endTime.sub(config.startTimestamp);

    // === VALIDATION: User position ===
    const sender = this.sender.getAndRequireSignature();
    const positionOption = await this.offchainState.fields.positions.get(sender);
    const existingPosition = positionOption.orElse(Position.empty());

    // Verify user hasn't switched before (one-time only)
    existingPosition.hasSwitched.assertFalse('Position already switched');

    // Verify user has enough on the losing side
    const losingAmount = Provable.if(toYes, existingPosition.noAmount, existingPosition.yesAmount);
    losingAmount.assertGreaterThanOrEqual(amount, 'Insufficient position to switch');

    // === VALIDATION: Time cutoff ===
    const switchCutoff = this.calculateSwitchCutoff(totalDuration);
    remaining.assertGreaterThan(switchCutoff, 'Too late to switch position');

    // Verify not in lockout period
    remaining.assertGreaterThan(MARKET_LOCKOUT_MS, 'Market in lockout period');

    // === HAIRCUT CALCULATION ===
    const haircutBps = this.calculateSwitchHaircut(remaining, totalDuration);
    const haircut = amount.mul(haircutBps).div(UInt64.from(10000));
    const netAfterHaircut = amount.sub(haircut);

    // Note: Haircut stays in the contract pools (implicit fee)
    // No external fee distribution since no new money is entering

    // === POOL UPDATES ===
    const yesPool = this.yesPool.getAndRequireEquals();
    const noPool = this.noPool.getAndRequireEquals();

    // Subtract from losing pool, add net to winning pool
    const newYesPool = Provable.if(
      toYes,
      safeAdd(yesPool, netAfterHaircut),  // Switching TO YES: add net to YES pool
      yesPool.sub(amount)                  // Switching FROM YES: subtract from YES pool
    );

    const newNoPool = Provable.if(
      toYes,
      noPool.sub(amount),                  // Switching FROM NO: subtract from NO pool
      safeAdd(noPool, netAfterHaircut)     // Switching TO NO: add net to NO pool
    );

    this.yesPool.set(newYesPool);
    this.noPool.set(newNoPool);

    // === USER POSITION UPDATE ===
    // Reduce losing side, increase winning side, mark as switched
    const newYesAmount = Provable.if(
      toYes,
      safeAdd(existingPosition.yesAmount, netAfterHaircut),  // Add net to YES
      existingPosition.yesAmount.sub(amount)                  // Subtract from YES
    );

    const newNoAmount = Provable.if(
      toYes,
      existingPosition.noAmount.sub(amount),                  // Subtract from NO
      safeAdd(existingPosition.noAmount, netAfterHaircut)     // Add net to NO
    );

    const updatedPosition = new Position({
      yesAmount: newYesAmount,
      noAmount: newNoAmount,
      claimed: existingPosition.claimed,
      hasSwitched: Bool(true),  // Mark as switched (can't switch again)
    });

    this.offchainState.fields.positions.update(sender, {
      from: existingPosition,
      to: updatedPosition,
    });
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
    this.send({ to: caller, amount: SETTLEMENT_REWARD });
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
    currentTime.assertGreaterThanOrEqual(endTs, 'Market has not ended yet');

    // Verify settlement timestamp parameter is after end time
    settlementTimestamp.assertGreaterThanOrEqual(endTs, 'Settlement timestamp must be after market end');

    // Determine outcome
    const cfg2 = (await this.offchainState.fields.config.get(Field(0))).value;
    const yesWins = finalPrice.greaterThanOrEqual(cfg2.priceThreshold);
    const outcome = Provable.if(yesWins, OUTCOME.YES, OUTCOME.NO);

    // Update status
    this.status.set(outcome);

    // Reward caller (9 MINA per spec)
    const caller = this.sender.getAndRequireSignature();
    this.send({ to: caller, amount: SETTLEMENT_REWARD });
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
      hasSwitched: position.hasSwitched,
    });

    this.offchainState.fields.positions.update(sender, {
      from: positionOption,
      to: updatedPosition,
    });

    // Get config for fee distribution addresses
    const configOption2 = await this.offchainState.fields.config.get(Field(0));
    const config = configOption2.value;

    // Transfer payout to user and distribute fees
    this.send({ to: sender, amount: netPayout });
    this.send({ to: config.creator, amount: feeSplit.creator });
    this.send({ to: config.burnAddress, amount: feeSplit.burn });
    this.send({ to: config.registryAddress, amount: feeSplit.platform });
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
   * V1: Calculate time-based late fee component
   * Returns fee in basis points (0-800 bps = 0-8%)
   *
   * Fee bands based on τ (normalized time remaining):
   * - τ ≥ 0.50: 0 bps
   * - 0.20 ≤ τ < 0.50: 150 bps (1.5%)
   * - 0.10 ≤ τ < 0.20: 300 bps (3%)
   * - 0.05 ≤ τ < 0.10: 500 bps (5%)
   * - τ < 0.05: 800 bps (8%)
   */
  private calculateTimeFee(remaining: UInt64, totalDuration: UInt64): UInt64 {
    // Calculate thresholds as fractions of total duration
    const threshold50 = totalDuration.div(UInt64.from(2));   // 50%
    const threshold20 = totalDuration.div(UInt64.from(5));   // 20%
    const threshold10 = totalDuration.div(UInt64.from(10));  // 10%
    const threshold05 = totalDuration.div(UInt64.from(20));  // 5%

    let timeFeeBps = UInt64.from(0);

    // τ < 0.05 (remaining < 5% of total)
    timeFeeBps = Provable.if(
      remaining.lessThan(threshold05),
      UInt64.from(800), // 8%
      timeFeeBps
    );

    // 0.05 ≤ τ < 0.10
    timeFeeBps = Provable.if(
      remaining.lessThan(threshold10).and(remaining.greaterThanOrEqual(threshold05)),
      UInt64.from(500), // 5%
      timeFeeBps
    );

    // 0.10 ≤ τ < 0.20
    timeFeeBps = Provable.if(
      remaining.lessThan(threshold20).and(remaining.greaterThanOrEqual(threshold10)),
      UInt64.from(300), // 3%
      timeFeeBps
    );

    // 0.20 ≤ τ < 0.50
    timeFeeBps = Provable.if(
      remaining.lessThan(threshold50).and(remaining.greaterThanOrEqual(threshold20)),
      UInt64.from(150), // 1.5%
      timeFeeBps
    );

    // τ ≥ 0.50: timeFeeBps stays 0

    return timeFeeBps;
  }

  /**
   * V1: Calculate pool imbalance fee component
   * Returns fee in basis points (0-500 bps = 0-5%)
   *
   * Formula: (100 - poolRatio) * 5
   * Where poolRatio = min(yes,no) / max(yes,no) * 100
   *
   * Examples:
   * - 50/50: ratio=100, fee=0%
   * - 70/30: ratio=43, fee=2.85%
   * - 90/10: ratio=11, fee=4.45%
   */
  private calculateImbalanceFee(yesPool: UInt64, noPool: UInt64): UInt64 {
    // Calculate imbalance fee: (1 - min/max) * 500 bps
    // For equal pools (50/50): fee = 0
    // For unequal pools (90/10): fee approaches 500 bps (5%)

    // Use witness to compute ratio without division in circuit
    const imbalanceBps = Provable.witness(UInt64, () => {
      const yesBig = yesPool.toBigInt();
      const noBig = noPool.toBigInt();

      // Avoid division by zero
      if (yesBig === 0n || noBig === 0n) return UInt64.from(500);

      // Calculate ratio (percentage of smaller to larger pool)
      const smaller = yesBig < noBig ? yesBig : noBig;
      const larger = yesBig > noBig ? yesBig : noBig;
      const ratio = (smaller * 100n) / larger; // 0-100

      // Imbalance fee: (100 - ratio) * 5 = 0-500 bps
      const fee = (100n - ratio) * 5n;
      return UInt64.from(fee > 500n ? 500n : fee);
    });

    // Return imbalance fee (0-500 bps = 0-5%)
    return imbalanceBps;
  }

  /**
   * V1: Calculate total late fee (time + imbalance, capped at 20%)
   */
  private calculateLateFee(
    remaining: UInt64,
    totalDuration: UInt64,
    yesPool: UInt64,
    noPool: UInt64
  ): UInt64 {
    const timeFeeBps = this.calculateTimeFee(remaining, totalDuration);
    const imbalanceFeeBps = this.calculateImbalanceFee(yesPool, noPool);

    const totalBps = timeFeeBps.add(imbalanceFeeBps);

    // Cap at MAX_LATE_FEE_BPS (2000 = 20%)
    const MAX_LATE_FEE_BPS = UInt64.from(2000);
    const cappedBps = Provable.if(
      totalBps.greaterThan(MAX_LATE_FEE_BPS),
      MAX_LATE_FEE_BPS,
      totalBps
    );

    return cappedBps;
  }

  /**
   * V1: Calculate normalized switch cutoff (1h-3h based on duration)
   * Returns cutoff time in milliseconds before market end
   *
   * Cutoff schedule:
   * - 1-6 days: 1 hour
   * - 7-13 days: 1.5 hours
   * - 14-20 days: 2 hours
   * - 21-30 days: 3 hours
   */
  private calculateSwitchCutoff(totalDuration: UInt64): UInt64 {
    const SEVEN_DAYS = UInt64.from(604800_000);      // 7 days in ms
    const FOURTEEN_DAYS = UInt64.from(1209600_000);  // 14 days in ms
    const TWENTYONE_DAYS = UInt64.from(1814400_000); // 21 days in ms

    const ONE_HOUR = UInt64.from(3600_000);       // 1 hour in ms
    const NINETY_MIN = UInt64.from(5400_000);     // 1.5 hours in ms
    const TWO_HOURS = UInt64.from(7200_000);      // 2 hours in ms
    const THREE_HOURS = UInt64.from(10800_000);   // 3 hours in ms

    let cutoff = ONE_HOUR; // Default: 1 hour

    // 21-30 days: 3 hours
    cutoff = Provable.if(
      totalDuration.greaterThanOrEqual(TWENTYONE_DAYS),
      THREE_HOURS,
      cutoff
    );

    // 14-20 days: 2 hours
    cutoff = Provable.if(
      totalDuration.greaterThanOrEqual(FOURTEEN_DAYS).and(
        totalDuration.lessThan(TWENTYONE_DAYS)
      ),
      TWO_HOURS,
      cutoff
    );

    // 7-13 days: 1.5 hours
    cutoff = Provable.if(
      totalDuration.greaterThanOrEqual(SEVEN_DAYS).and(
        totalDuration.lessThan(FOURTEEN_DAYS)
      ),
      NINETY_MIN,
      cutoff
    );

    // 1-6 days: 1 hour (cutoff stays at ONE_HOUR)

    return cutoff;
  }

  /**
   * V1: Calculate switch position haircut (flat 15% or 25%)
   * Returns haircut in basis points
   *
   * Haircut schedule:
   * - Early (τ ≥ 0.50): 15% (1500 bps)
   * - Late (τ < 0.50): 25% (2500 bps)
   */
  private calculateSwitchHaircut(remaining: UInt64, totalDuration: UInt64): UInt64 {
    const threshold50 = totalDuration.div(UInt64.from(2)); // 50% of duration

    // If remaining >= 50% of total: 15%, else 25%
    const haircutBps = Provable.if(
      remaining.greaterThanOrEqual(threshold50),
      UInt64.from(1500), // 15% (early)
      UInt64.from(2500)  // 25% (late)
    );

    return haircutBps;
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
