/**
 * Constants for Prediction Market Platform
 *
 * These constants define core parameters and multiplication factors
 * to avoid decimal arithmetic in ZK circuits.
 */
import { UInt64 } from 'o1js';
/**
 * MULTIPLICATION_FACTOR: Used to convert decimal values to integers
 * Same as Doot Oracle's multiplication factor for price consistency
 *
 * Example: 0.5 MINA = 0.5 * 10^10 = 5000000000
 */
export declare const MULTIPLICATION_FACTOR: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
/**
 * MINA_DECIMALS: Native MINA has 9 decimal places (nanomina precision)
 * 1 MINA = 1,000,000,000 nanomina
 */
export declare const MINA_DECIMALS = 9;
export declare const LAMPORTS_PER_MINA = 1000000000;
/**
 * CREATOR_DEPOSIT: Amount creator must deposit to create a market
 * Set to 10 MINA - serves dual purpose:
 * 1. Spam prevention barrier
 * 2. Settlement incentive reward (goes to whoever calls settle())
 */
export declare const CREATOR_DEPOSIT: UInt64;
/**
 * SETTLEMENT_REWARD: Portion of creator deposit rewarded to the caller who settles
 * 9 MINA as per spec
 */
export declare const SETTLEMENT_REWARD: UInt64;
/**
 * INITIAL_LIQUIDITY: Initial liquidity split between YES/NO pools
 * From the 10 MINA deposit, 5 MINA goes to each pool
 * This provides initial liquidity for the AMM
 */
export declare const INITIAL_POOL_AMOUNT: UInt64;
/**
 * MARKET_LOCKOUT_PERIOD: Time before market end when betting is disabled
 * Set to 1800 seconds (30 minutes) to prevent last-second manipulation
 */
export declare const MARKET_LOCKOUT_MS: UInt64;
/**
 * FEE_BASIS_POINTS: Fee taken from winner claims
 * 20 basis points = 0.2%
 * Formula: fee = (amount * FEE_BASIS_POINTS) / BASIS_POINTS_DIVISOR
 */
export declare const FEE_BASIS_POINTS: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
export declare const BASIS_POINTS_DIVISOR: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
/**
 * FEE_DISTRIBUTION:
 * - 20% to market creator
 * - 50% burned
 * - 50% kept by platform
 * (Percentages apply to collected fees)
 */
export declare const CREATOR_FEE_SHARE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
export declare const BURN_FEE_SHARE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
export declare const PLATFORM_FEE_SHARE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
export declare const PERCENTAGE_DIVISOR: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
/**
 * DOOT_SUPPORTED_ASSETS: Asset indices matching Doot Oracle token array
 * 0: MINA, 1: BTC, 2: ETH, 3: SOL, 4: XRP, 5: ADA, 6: AVAX, 7: MATIC, 8: LINK, 9: DOGE
 */
export declare const ASSET_INDEX: {
    readonly MINA: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly BITCOIN: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly ETHEREUM: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly SOLANA: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly RIPPLE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly CARDANO: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly AVALANCHE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly POLYGON: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly CHAINLINK: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly DOGECOIN: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
};
/**
 * MAX_ASSET_INDEX: Maximum valid asset index (9 for 10 supported assets)
 */
export declare const MAX_ASSET_INDEX: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
/**
 * MARKET_STATUS: Enum-like Field values for market states
 * Used for tracking market lifecycle
 */
export declare const MARKET_STATUS: {
    readonly ACTIVE: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly LOCKED: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly AWAITING: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly SETTLED: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
};
/**
 * OUTCOME: Prediction outcome values
 */
export declare const OUTCOME: {
    readonly PENDING: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly YES: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
    readonly NO: import("node_modules/o1js/dist/node/lib/provable/field.js").Field;
};
/**
 * MINIMUM_BET: Absolute minimum bet amount
 * Set to 0.1 MINA as per spec (entry minimum)
 * 0.1 MINA = 100,000,000 nanomina
 */
export declare const MINIMUM_BET: UInt64;
/**
 * TIME_CONSTRAINTS: Min/max market duration
 * - Minimum: 1 day (86400 seconds)
 * - Maximum: 7 days (604800 seconds)
 */
export declare const MIN_MARKET_DURATION_MS: UInt64;
export declare const MAX_MARKET_DURATION_MS: UInt64;
