/**
 * MarketRegistry.ts - Central registry for all prediction markets
 *
 * This contract acts as the "factory" by tracking all deployed markets.
 * Market contracts are deployed separately (by backend), then registered here.
 *
 * Key responsibilities:
 * - Track all market addresses and metadata
 * - Maintain market count
 * - Provide market lookup by ID
 * - Update market status as lifecycle progresses
 *
 * State usage: 3 Fields (well within 8 Field limit)
 */
import { __decorate, __metadata } from "tslib";
import { SmartContract, state, State, method, PublicKey, Field, Experimental, Permissions, } from 'o1js';
const { OffchainState } = Experimental;
import { MarketInfo } from '../types/index.js';
/**
 * Offchain state configuration for MarketRegistry
 *
 * Stores: marketId (Field) → MarketInfo (address, creator, asset, time, status)
 * This allows unlimited markets without hitting on-chain state limits
 */
export const marketRegistryOffchainState = OffchainState({
    markets: OffchainState.Map(Field, MarketInfo),
});
export class MarketRegistryOffchainStateProof extends marketRegistryOffchainState.Proof {
}
/**
 * MarketRegistry Contract
 *
 * Central registry tracking all prediction markets in the platform.
 * Markets are deployed by backend service, then registered on-chain.
 */
export class MarketRegistry extends SmartContract {
    constructor() {
        super(...arguments);
        /**
         * marketCount: Total number of markets ever created
         * Used to generate unique market IDs (0, 1, 2, ...)
         */
        this.marketCount = State();
        /**
         * owner: Contract owner (can perform admin functions)
         * Set during initialization, immutable afterward
         */
        this.owner = State();
        /**
         * offchainStateCommitments: Root of offchain state Merkle tree
         * Managed automatically by OffchainState framework
         */
        this.offchainStateCommitments = marketRegistryOffchainState.emptyCommitments();
        // Initialize offchain state
        this.offchainState = marketRegistryOffchainState.init(this);
    }
    /**
     * deploy: Set up contract permissions
     *
     * Permissions strategy:
     * - setPermissions: impossible (prevent permission changes)
     * - Access: proof (require ZK proofs for all operations)
     */
    async deploy() {
        await super.deploy();
        this.account.permissions.set({
            ...Permissions.default(),
            setPermissions: Permissions.impossible(),
            access: Permissions.none(),
        });
    }
    /**
     * Initialize registry
     *
     * Sets the deployer as owner and initializes market count to 0.
     * Can only be called once (when owner is empty).
     */
    async initialize() {
        // Verify this is first initialization
        this.owner.getAndRequireEquals().assertEquals(PublicKey.empty());
        // Set caller as owner
        const sender = this.sender.getAndRequireSignature();
        this.owner.set(sender);
        // Initialize market count
        this.marketCount.set(Field(0));
    }
    /**
     * Register a new market
     *
     * Called by backend service after deploying a PredictionMarket contract.
     * Stores market metadata in offchain state and increments counter.
     *
     * @param marketAddress - Address of deployed PredictionMarket contract
     * @param creator - Address that funded the market creation
     * @param assetIndex - Asset being predicted (0-9)
     * @param endTimestamp - When market closes
     * @returns marketId - Unique ID for this market
     */
    async registerMarket(marketAddress, creator, assetIndex, endTimestamp) {
        // Only owner can register markets (prevents spam)
        const owner = this.owner.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        sender.assertEquals(owner);
        // Get current market count (this becomes the marketId)
        const currentCount = this.marketCount.getAndRequireEquals();
        const marketId = currentCount;
        // Create market info
        const marketInfo = MarketInfo.create(marketAddress, creator, assetIndex, endTimestamp);
        // Store in offchain state
        const existingMarket = await this.offchainState.fields.markets.get(marketId);
        this.offchainState.fields.markets.update(marketId, {
            from: existingMarket,
            to: marketInfo,
        });
        // Increment market count
        const newCount = currentCount.add(Field(1));
        this.marketCount.set(newCount);
        return marketId;
    }
    /**
     * Get market info by ID
     *
     * Retrieves market metadata from offchain state.
     * This is a view function (returns data without modifying state).
     *
     * @param marketId - Market ID to lookup
     * @returns MarketInfo for the specified market
     */
    async getMarket(marketId) {
        // Verify marketId is valid (< marketCount)
        const count = this.marketCount.getAndRequireEquals();
        marketId.assertLessThan(count, 'Market ID does not exist');
        // Retrieve from offchain state
        const marketOption = await this.offchainState.fields.markets.get(marketId);
        return marketOption.value;
    }
    /**
     * Update market status
     *
     * Called by backend service to update market lifecycle state.
     * Useful for tracking ACTIVE → LOCKED → AWAITING → SETTLED transitions.
     *
     * @param marketId - Market to update
     * @param newStatus - New status value (0-3)
     */
    async updateMarketStatus(marketId, newStatus) {
        // Only owner can update status
        const owner = this.owner.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        sender.assertEquals(owner);
        // Verify marketId exists
        const count = this.marketCount.getAndRequireEquals();
        marketId.assertLessThan(count);
        // Get current market info
        const currentMarket = await this.offchainState.fields.markets.get(marketId);
        const currentInfo = currentMarket.value;
        // Create updated info with new status
        const updatedInfo = currentInfo.withStatus(newStatus);
        // Update in offchain state
        this.offchainState.fields.markets.update(marketId, {
            from: currentMarket,
            to: updatedInfo,
        });
    }
    /**
     * Settle offchain state
     *
     * Commits batched offchain state updates on-chain.
     * Must be called periodically (similar to Doot's settlement pattern).
     *
     * @param proof - Settlement proof for offchain state changes
     */
    async settle(proof) {
        await this.offchainState.settle(proof);
    }
    /**
     * Get total market count
     *
     * View function to check how many markets have been created.
     */
    async getTotalMarkets() {
        return this.marketCount.getAndRequireEquals();
    }
    /**
     * Get contract owner
     *
     * View function to retrieve the owner address.
     */
    async getOwner() {
        return this.owner.getAndRequireEquals();
    }
}
__decorate([
    state(Field),
    __metadata("design:type", Object)
], MarketRegistry.prototype, "marketCount", void 0);
__decorate([
    state(PublicKey),
    __metadata("design:type", Object)
], MarketRegistry.prototype, "owner", void 0);
__decorate([
    state(OffchainState.Commitments),
    __metadata("design:type", Object)
], MarketRegistry.prototype, "offchainStateCommitments", void 0);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "initialize", null);
__decorate([
    method.returns(Field),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublicKey,
        PublicKey,
        Field,
        Field]),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "registerMarket", null);
__decorate([
    method.returns(MarketInfo),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Field]),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "getMarket", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Field, Field]),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "updateMarketStatus", null);
__decorate([
    method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MarketRegistryOffchainStateProof]),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "settle", null);
__decorate([
    method.returns(Field),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "getTotalMarkets", null);
__decorate([
    method.returns(PublicKey),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MarketRegistry.prototype, "getOwner", null);
//# sourceMappingURL=MarketRegistry.js.map