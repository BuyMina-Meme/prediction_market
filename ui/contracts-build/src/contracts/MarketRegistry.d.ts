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
import { SmartContract, State, PublicKey, Field } from 'o1js';
import { MarketInfo } from '../types/index.js';
/**
 * Offchain state configuration for MarketRegistry
 *
 * Stores: marketId (Field) → MarketInfo (address, creator, asset, time, status)
 * This allows unlimited markets without hitting on-chain state limits
 */
export declare const marketRegistryOffchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainState<{
    readonly markets: {
        kind: "offchain-map";
        keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
        valueType: typeof MarketInfo;
    };
}>;
export declare class MarketRegistryOffchainStateProof extends marketRegistryOffchainState.Proof {
}
/**
 * MarketRegistry Contract
 *
 * Central registry tracking all prediction markets in the platform.
 * Markets are deployed by backend service, then registered on-chain.
 */
export declare class MarketRegistry extends SmartContract {
    /**
     * marketCount: Total number of markets ever created
     * Used to generate unique market IDs (0, 1, 2, ...)
     */
    marketCount: State<import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    /**
     * owner: Contract owner (can perform admin functions)
     * Set during initialization, immutable afterward
     */
    owner: State<PublicKey>;
    /**
     * offchainStateCommitments: Root of offchain state Merkle tree
     * Managed automatically by OffchainState framework
     */
    offchainStateCommitments: State<import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state-rollup.js").OffchainStateCommitments>;
    offchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainStateInstance<{
        readonly markets: {
            kind: "offchain-map";
            keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
            valueType: typeof MarketInfo;
        };
    }>;
    /**
     * deploy: Set up contract permissions
     *
     * Permissions strategy:
     * - setPermissions: impossible (prevent permission changes)
     * - Access: proof (require ZK proofs for all operations)
     */
    deploy(): Promise<void>;
    /**
     * Initialize registry
     *
     * Sets the deployer as owner and initializes market count to 0.
     * Can only be called once (when owner is empty).
     */
    initialize(): Promise<void>;
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
    registerMarket(marketAddress: PublicKey, creator: PublicKey, assetIndex: Field, endTimestamp: Field): Promise<Field>;
    /**
     * Get market info by ID
     *
     * Retrieves market metadata from offchain state.
     * This is a view function (returns data without modifying state).
     *
     * @param marketId - Market ID to lookup
     * @returns MarketInfo for the specified market
     */
    getMarket(marketId: Field): Promise<MarketInfo>;
    /**
     * Update market status
     *
     * Called by backend service to update market lifecycle state.
     * Useful for tracking ACTIVE → LOCKED → AWAITING → SETTLED transitions.
     *
     * @param marketId - Market to update
     * @param newStatus - New status value (0-3)
     */
    updateMarketStatus(marketId: Field, newStatus: Field): Promise<void>;
    /**
     * Settle offchain state
     *
     * Commits batched offchain state updates on-chain.
     * Must be called periodically (similar to Doot's settlement pattern).
     *
     * @param proof - Settlement proof for offchain state changes
     */
    settle(proof: MarketRegistryOffchainStateProof): Promise<void>;
    /**
     * Get total market count
     *
     * View function to check how many markets have been created.
     */
    getTotalMarkets(): Promise<Field>;
    /**
     * Get contract owner
     *
     * View function to retrieve the owner address.
     */
    getOwner(): Promise<PublicKey>;
}
