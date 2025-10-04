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
 * State usage: 3 on-chain Fields + 4 for offchainState = 7 Fields total (within 8 Field limit)
 *
 * CRITICAL OPTIMIZATION: Market config (asset, threshold, endTime, creator) stored in offchain state
 */
import { __decorate, __metadata } from "tslib";
import { SmartContract, state, State, method, PublicKey, Field, UInt64, Bool, Experimental, Permissions, AccountUpdate, Provable, Struct, } from 'o1js';
const { OffchainState } = Experimental;
import { Position, INITIAL_POOL_AMOUNT, CREATOR_DEPOSIT, SETTLEMENT_REWARD, OUTCOME, MINIMUM_BET, MIN_MARKET_DURATION_MS, MAX_MARKET_DURATION_MS, MARKET_LOCKOUT_MS, } from '../types/index.js';
import { MarketMath, safeAdd } from '../utils/MarketMath.js';
import { Doot, DootOracleClient } from '../utils/DootOracle.js';
/**
 * MarketConfig - Stored in offchain state to save on-chain Fields
 */
export class MarketConfig extends Struct({
    assetIndex: Field, // 0-9 (MINA, BTC, ETH...)
    priceThreshold: Field, // Price threshold in Doot format
    endTimestamp: UInt64, // Market end time
    creator: PublicKey, // Market creator
    burnAddress: PublicKey, // Burn address (40% of fees)
    registryAddress: PublicKey, // MarketRegistry treasury (40% of fees)
}) {
}
/**
 * Offchain state for PredictionMarket
 *
 * Note: config is stored as a Map with single key Field(0) for compatibility
 */
export const predictionMarketOffchainState = OffchainState({
    config: OffchainState.Map(Field, MarketConfig),
    positions: OffchainState.Map(PublicKey, Position),
});
export class PredictionMarketOffchainStateProof extends predictionMarketOffchainState.Proof {
}
/**
 * PredictionMarket Contract (FIELD-OPTIMIZED)
 *
 * On-chain state: 3 Fields
 * - yesPool (UInt64 = 1 Field)
 * - noPool (UInt64 = 1 Field)
 * - status (Field = 1 Field): 0=active, 1=YES won, 2=NO won
 * - offchainStateCommitments (4 Fields)
 *
 * Total: 7 Fields (within 8 limit)
 */
export class PredictionMarket extends SmartContract {
    constructor() {
        super(...arguments);
        /**
         * yesPool: Total amount in YES pool (nanomina)
         */
        this.yesPool = State();
        /**
         * noPool: Total amount in NO pool (nanomina)
         */
        this.noPool = State();
        /**
         * status: Combined settlement status
         * 0 = ACTIVE (accepting bets)
         * 1 = SETTLED_YES (YES won)
         * 2 = SETTLED_NO (NO won)
         */
        this.status = State();
        /**
         * endTime: Market end time in ms (on-chain for reliable time checks)
         */
        this.endTime = State();
        /**
         * offchainStateCommitments: Merkle root for offchain data
         */
        this.offchainStateCommitments = predictionMarketOffchainState.emptyCommitments();
        this.offchainState = predictionMarketOffchainState.init(this);
    }
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
    async initialize(assetIdx, threshold, endTime, creatorAddress, burnAddress, registryAddress) {
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
    async buyYes(amount) {
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
    async buyNo(amount) {
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
    async settleWithDoot(dootAddress) {
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
    async settleMarket(finalPrice, settlementTimestamp) {
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
        const grossPayout = MarketMath.calculateProportionalPayout(userWinningAmount, winningPool, totalPool);
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
    async settle(proof) {
        this.offchainState.setContractInstance(this);
        await this.offchainState.settle(proof);
    }
    /**
     * Verify betting is allowed (not in lockout period)
     */
    async verifyBettingAllowed() {
        const currentTime = this.network.timestamp.getAndRequireEquals();
        const endTs = this.endTime.getAndRequireEquals();
        const lockoutStart = endTs.sub(MARKET_LOCKOUT_MS); // 30 min in ms
        currentTime.assertLessThan(lockoutStart);
    }
    /**
     * Get user position
     */
    async getPosition(user) {
        this.offchainState.setContractInstance(this);
        const positionOption = await this.offchainState.fields.positions.get(user);
        return positionOption.orElse(Position.empty());
    }
}
__decorate([
    state(UInt64),
    __metadata("design:type", Object)
], PredictionMarket.prototype, "yesPool", void 0);
__decorate([
    state(UInt64),
    __metadata("design:type", Object)
], PredictionMarket.prototype, "noPool", void 0);
__decorate([
    state(Field),
    __metadata("design:type", Object)
], PredictionMarket.prototype, "status", void 0);
__decorate([
    state(UInt64),
    __metadata("design:type", Object)
], PredictionMarket.prototype, "endTime", void 0);
__decorate([
    state(OffchainState.Commitments),
    __metadata("design:type", Object)
], PredictionMarket.prototype, "offchainStateCommitments", void 0);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Field,
        Field,
        UInt64,
        PublicKey,
        PublicKey,
        PublicKey]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "initialize", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UInt64]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "buyYes", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UInt64]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "buyNo", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublicKey]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "settleWithDoot", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Field, UInt64]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "settleMarket", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "claim", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PredictionMarketOffchainStateProof]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "settle", null);
__decorate([
    method.returns(Position),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublicKey]),
    __metadata("design:returntype", Promise)
], PredictionMarket.prototype, "getPosition", null);
//# sourceMappingURL=PredictionMarket.js.map