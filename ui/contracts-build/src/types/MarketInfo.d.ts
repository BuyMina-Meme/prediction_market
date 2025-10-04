/**
 * MarketInfo.ts - Registry tracking data for markets
 *
 * Stored in MarketRegistry's offchain state to track all deployed markets.
 */
import { PublicKey, Field, Bool } from 'o1js';
declare const MarketInfo_base: (new (value: {
    marketAddress: PublicKey;
    creator: PublicKey;
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
}) => {
    marketAddress: PublicKey;
    creator: PublicKey;
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
}) & {
    _isStruct: true;
} & Omit<import("node_modules/o1js/dist/node/lib/provable/types/provable-intf.js").Provable<{
    marketAddress: PublicKey;
    creator: PublicKey;
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
}, {
    marketAddress: {
        x: bigint;
        isOdd: boolean;
    };
    creator: {
        x: bigint;
        isOdd: boolean;
    };
    assetIndex: bigint;
    endTimestamp: bigint;
    status: bigint;
}>, "fromFields"> & {
    fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[]) => {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    };
} & {
    fromValue: (value: {
        marketAddress: PublicKey | {
            x: Field | bigint;
            isOdd: Bool | boolean;
        };
        creator: PublicKey | {
            x: Field | bigint;
            isOdd: Bool | boolean;
        };
        assetIndex: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    }) => {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    };
    toInput: (x: {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    }) => {
        fields?: Field[] | undefined;
        packed?: [Field, number][] | undefined;
    };
    toJSON: (x: {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    }) => {
        marketAddress: string;
        creator: string;
        assetIndex: string;
        endTimestamp: string;
        status: string;
    };
    fromJSON: (x: {
        marketAddress: string;
        creator: string;
        assetIndex: string;
        endTimestamp: string;
        status: string;
    }) => {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    };
    empty: () => {
        marketAddress: PublicKey;
        creator: PublicKey;
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        status: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    };
};
/**
 * MarketInfo: Metadata tracked by MarketRegistry
 *
 * @property marketAddress - Address of the deployed PredictionMarket contract
 * @property creator - Address that created and funded the market
 * @property assetIndex - Which asset is being predicted (0-9)
 * @property endTimestamp - When market closes for betting
 * @property status - Current market status (ACTIVE/LOCKED/AWAITING/SETTLED)
 *
 * Storage: MarketRegistry offchain state (marketId → MarketInfo)
 */
export declare class MarketInfo extends MarketInfo_base {
    /**
     * Creates a new market info entry
     */
    static create(marketAddress: PublicKey, creator: PublicKey, assetIndex: Field, endTimestamp: Field): MarketInfo;
    /**
     * Check if market is active (accepting bets)
     */
    isActive(): Bool;
    /**
     * Check if market is locked (within lockout period)
     */
    isLocked(): Bool;
    /**
     * Check if market is awaiting settlement
     */
    isAwaiting(): Bool;
    /**
     * Check if market is settled
     */
    isSettled(): Bool;
    /**
     * Update market status
     */
    withStatus(newStatus: Field): MarketInfo;
}
export { Struct, PublicKey, Field, Bool } from 'o1js';
export { MARKET_STATUS } from './Constants.js';
