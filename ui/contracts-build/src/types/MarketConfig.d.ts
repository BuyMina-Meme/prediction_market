/**
 * MarketConfig.ts - Market configuration and parameters
 *
 * Defines the core parameters for a prediction market including
 * the asset being predicted, price threshold, and timing.
 */
import { Field, UInt64, Bool } from 'o1js';
declare const MarketConfig_base: (new (value: {
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    minBet: UInt64;
}) => {
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    minBet: UInt64;
}) & {
    _isStruct: true;
} & Omit<import("node_modules/o1js/dist/node/lib/provable/types/provable-intf.js").Provable<{
    assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    minBet: UInt64;
}, {
    assetIndex: bigint;
    priceThreshold: bigint;
    endTimestamp: bigint;
    minBet: bigint;
}>, "fromFields"> & {
    fromFields: (fields: import("node_modules/o1js/dist/node/lib/provable/field.js").Field[]) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    };
} & {
    fromValue: (value: {
        assetIndex: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: string | number | bigint | import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: number | bigint | UInt64;
    }) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    };
    toInput: (x: {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    }) => {
        fields?: Field[] | undefined;
        packed?: [Field, number][] | undefined;
    };
    toJSON: (x: {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    }) => {
        assetIndex: string;
        priceThreshold: string;
        endTimestamp: string;
        minBet: string;
    };
    fromJSON: (x: {
        assetIndex: string;
        priceThreshold: string;
        endTimestamp: string;
        minBet: string;
    }) => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    };
    empty: () => {
        assetIndex: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        priceThreshold: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        endTimestamp: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
        minBet: UInt64;
    };
};
/**
 * MarketConfig: Immutable configuration set at market creation
 *
 * @property assetIndex - Index of asset in Doot Oracle (0-9)
 *   0=MINA, 1=BTC, 2=ETH, 3=SOL, 4=XRP, 5=ADA, 6=AVAX, 7=MATIC, 8=LINK, 9=DOGE
 *
 * @property priceThreshold - Price threshold in Doot format (price * 10^10)
 *   Example: $3400.00 → 34000000000000 (3400 * 10^10)
 *
 * @property endTimestamp - Unix timestamp (seconds) when market closes
 *   Betting locks 30 minutes before this time
 *
 * @property minBet - Minimum bet amount in nanomina
 *   Default: 1 nanomina (0.000000001 MINA) for testing
 *   Production: Could be higher to reduce spam
 *
 * State Storage: These fields are stored on-chain in PredictionMarket contract
 * Field Count: 4 Fields total
 */
export declare class MarketConfig extends MarketConfig_base {
    /**
     * Validates market configuration
     * Ensures all parameters are within acceptable ranges
     */
    validate(currentTimestamp: Field): void;
    /**
     * Check if market is past end time
     */
    isPastEndTime(currentTimestamp: Field): Bool;
    /**
     * Check if market is in lockout period (30 min before end)
     */
    isInLockoutPeriod(currentTimestamp: Field, lockoutSeconds: Field): Bool;
    /**
     * Check if betting is allowed at current time
     */
    isBettingAllowed(currentTimestamp: Field, lockoutSeconds: Field): Bool;
}
export { Struct, Field, UInt64, Bool } from 'o1js';
