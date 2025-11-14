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

import {
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Field,
  Experimental,
  Permissions,
} from 'o1js';

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

export class MarketRegistryOffchainStateProof extends marketRegistryOffchainState.Proof {}

/**
 * MarketRegistry Contract
 *
 * Central registry tracking all prediction markets in the platform.
 * Markets are deployed by backend service, then registered on-chain.
 */
export class MarketRegistry extends SmartContract {
  /**
   * marketCount: Total number of markets ever created
   * Used to generate unique market IDs (0, 1, 2, ...)
   */
  @state(Field) marketCount = State<Field>();

  /**
   * owner: Contract owner (can perform admin functions)
   * Set during initialization, immutable afterward
   */
  @state(PublicKey) owner = State<PublicKey>();

  /**
   * offchainStateCommitments: Root of offchain state Merkle tree
   * Managed automatically by OffchainState framework
   */
  @state(OffchainState.Commitments) offchainStateCommitments =
    marketRegistryOffchainState.emptyCommitments();

  // Initialize offchain state
  offchainState = marketRegistryOffchainState.init(this);

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
  @method
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
  @method.returns(Field)
  async registerMarket(
    marketAddress: PublicKey,
    creator: PublicKey,
    assetIndex: Field,
    endTimestamp: Field
  ): Promise<Field> {
    this.offchainState.setContractInstance(this);

    // Only owner can register markets (prevents spam)
    const owner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.assertEquals(owner);

    // Get current market count (this becomes the marketId)
    const currentCount = this.marketCount.getAndRequireEquals();
    const marketId = currentCount;

    // Create market info
    const marketInfo = MarketInfo.create(
      marketAddress,
      creator,
      assetIndex,
      endTimestamp
    );

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
  @method.returns(MarketInfo)
  async getMarket(marketId: Field): Promise<MarketInfo> {
    this.offchainState.setContractInstance(this);

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
  @method
  async updateMarketStatus(marketId: Field, newStatus: Field) {
    this.offchainState.setContractInstance(this);

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
  @method
  async settle(proof: MarketRegistryOffchainStateProof) {
    this.offchainState.setContractInstance(this);
    await this.offchainState.settle(proof);
  }

  /**
   * Get total market count
   *
   * View function to check how many markets have been created.
   */
  @method.returns(Field)
  async getTotalMarkets(): Promise<Field> {
    return this.marketCount.getAndRequireEquals();
  }

  /**
   * Get contract owner
   *
   * View function to retrieve the owner address.
   */
  @method.returns(PublicKey)
  async getOwner(): Promise<PublicKey> {
    return this.owner.getAndRequireEquals();
  }
}
