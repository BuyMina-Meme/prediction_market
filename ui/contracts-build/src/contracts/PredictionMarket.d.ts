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
import { SmartContract, State, PublicKey, Field, UInt64, Bool } from 'o1js';
import { Position } from '../types/index.js';
declare const MarketConfig_base: (new (value: {
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: UInt64;
    creator: PublicKey;
    burnAddress: PublicKey;
    registryAddress: PublicKey;
}) => {
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: UInt64;
    creator: PublicKey;
    burnAddress: PublicKey;
    registryAddress: PublicKey;
}) & {
    _isStruct: true;
} & Omit<import("node_modules/o1js/dist/node/lib/provable/types/provable-intf.js").Provable<{
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: UInt64;
    creator: PublicKey;
    burnAddress: PublicKey;
    registryAddress: PublicKey;
}, {
    assetIndex: bigint;
    priceThreshold: bigint;
    endTimestamp: bigint;
    creator: {
        x: bigint;
        isOdd: boolean;
    };
    burnAddress: {
        x: bigint;
        isOdd: boolean;
    };
    registryAddress: {
        x: bigint;
        isOdd: boolean;
    };
}>, "fromFields"> & {
    fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[]) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    };
} & {
    fromValue: (value: {
        assetIndex: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: number | bigint | UInt64;
        creator: PublicKey | {
            x: Field | bigint;
            isOdd: Bool | boolean;
        };
        burnAddress: PublicKey | {
            x: Field | bigint;
            isOdd: Bool | boolean;
        };
        registryAddress: PublicKey | {
            x: Field | bigint;
            isOdd: Bool | boolean;
        };
    }) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    };
    toInput: (x: {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    }) => {
        fields?: Field[] | undefined;
        packed?: [Field, number][] | undefined;
    };
    toJSON: (x: {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    }) => {
        assetIndex: string;
        priceThreshold: string;
        endTimestamp: string;
        creator: string;
        burnAddress: string;
        registryAddress: string;
    };
    fromJSON: (x: {
        assetIndex: string;
        priceThreshold: string;
        endTimestamp: string;
        creator: string;
        burnAddress: string;
        registryAddress: string;
    }) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    };
    empty: () => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: UInt64;
        creator: PublicKey;
        burnAddress: PublicKey;
        registryAddress: PublicKey;
    };
};
/**
 * MarketConfig - Stored in offchain state to save on-chain Fields
 */
export declare class MarketConfig extends MarketConfig_base {
}
/**
 * Offchain state for PredictionMarket
 *
 * Note: config is stored as a Map with single key Field(0) for compatibility
 */
export declare const predictionMarketOffchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainState<{
    readonly config: {
        kind: "offchain-map";
        keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
        valueType: typeof MarketConfig;
    };
    readonly positions: {
        kind: "offchain-map";
        keyType: typeof PublicKey;
        valueType: typeof Position;
    };
}>;
export declare class PredictionMarketOffchainStateProof extends predictionMarketOffchainState.Proof {
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
export declare class PredictionMarket extends SmartContract {
    /**
     * yesPool: Total amount in YES pool (nanomina)
     */
    yesPool: State<UInt64>;
    /**
     * noPool: Total amount in NO pool (nanomina)
     */
    noPool: State<UInt64>;
    /**
     * status: Combined settlement status
     * 0 = ACTIVE (accepting bets)
     * 1 = SETTLED_YES (YES won)
     * 2 = SETTLED_NO (NO won)
     */
    status: State<import("node_modules/o1js/dist/node/lib/provable/field.js").Field>;
    /**
     * endTime: Market end time in ms (on-chain for reliable time checks)
     */
    endTime: State<UInt64>;
    /**
     * offchainStateCommitments: Merkle root for offchain data
     */
    offchainStateCommitments: State<import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state-rollup.js").OffchainStateCommitments>;
    offchainState: import("node_modules/o1js/dist/node/lib/mina/v1/actions/offchain-state.js").OffchainStateInstance<{
        readonly config: {
            kind: "offchain-map";
            keyType: typeof import("node_modules/o1js/dist/node/lib/provable/field.js").Field & ((x: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldConst | import("node_modules/o1js/dist/node/lib/provable/core/fieldvar.js").FieldVar | import("node_modules/o1js/dist/node/lib/provable/field.js").Field) => import("node_modules/o1js/dist/node/lib/provable/field.js").Field);
            valueType: typeof MarketConfig;
        };
        readonly positions: {
            kind: "offchain-map";
            keyType: typeof PublicKey;
            valueType: typeof Position;
        };
    }>;
    deploy(): Promise<void>;
    /**
     * Initialize market
     *
     * Sets up market with config in offchain state and initial liquidity on-chain.
     * Creator sends 10 MINA which seeds 5 MINA YES + 5 MINA NO pools.
     */
    initialize(assetIdx: Field, threshold: Field, endTime: UInt64, creatorAddress: PublicKey, burnAddress: PublicKey, registryAddress: PublicKey): Promise<void>;
    /**
     * Buy YES tokens
     */
    buyYes(amount: UInt64): Promise<void>;
    /**
     * Buy NO tokens
     */
    buyNo(amount: UInt64): Promise<void>;
    /**
     * Settle market with Doot Oracle
     */
    settleWithDoot(dootAddress: PublicKey): Promise<void>;
    /**
     * Settle market with manual price (for testing)
     */
    settleMarket(finalPrice: Field, settlementTimestamp: UInt64): Promise<void>;
    /**
     * Claim winnings
     */
    claim(): Promise<void>;
    /**
     * Settle offchain state
     */
    settle(proof: PredictionMarketOffchainStateProof): Promise<void>;
    /**
     * Verify betting is allowed (not in lockout period)
     */
    private verifyBettingAllowed;
    /**
     * Get user position
     */
    getPosition(user: PublicKey): Promise<Position>;
}
export {};
