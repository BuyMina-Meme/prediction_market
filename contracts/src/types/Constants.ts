/**
 * Constants for Prediction Market Platform
 *
 * These constants define core parameters and multiplication factors
 * to avoid decimal arithmetic in ZK circuits.
 */

import { Field, UInt64 } from 'o1js';

/**
 * MULTIPLICATION_FACTOR: Used to convert decimal values to integers
 * Same as Doot Oracle's multiplication factor for price consistency
 *
 * Example: 0.5 MINA = 0.5 * 10^10 = 5000000000
 */
export const MULTIPLICATION_FACTOR = Field(10_000_000_000); // 10^10

/**
 * MINA_DECIMALS: Native MINA has 9 decimal places (nanomina precision)
 * 1 MINA = 1,000,000,000 nanomina
 */
export const MINA_DECIMALS = 9;
export const LAMPORTS_PER_MINA = 1_000_000_000; // 10^9

/**
 * CREATOR_DEPOSIT: Amount creator must deposit to create a market
 * Set to 10 MINA - serves dual purpose:
 * 1. Spam prevention barrier
 * 2. Settlement incentive reward (goes to whoever calls settle())
 */
export const CREATOR_DEPOSIT = UInt64.from(10 * LAMPORTS_PER_MINA); // 10 MINA in nanomina

/**
 * SETTLEMENT_REWARD: Portion of creator deposit rewarded to the caller who settles
 * 9 MINA as per spec
 */
export const SETTLEMENT_REWARD = UInt64.from(9 * LAMPORTS_PER_MINA); // 9 MINA in nanomina

/**
 * INITIAL_LIQUIDITY: Initial liquidity split between YES/NO pools
 * V1 MVP: 5 MINA per pool to reduce early bettor variance
 * This provides healthier initial liquidity and fairer early pricing
 */
export const INITIAL_POOL_AMOUNT = UInt64.from(5 * LAMPORTS_PER_MINA); // 5 MINA per pool

/**
 * MARKET_LOCKOUT_PERIOD: Time before market end when betting is disabled
 * Set to 1800 seconds (30 minutes) to prevent last-second manipulation
 */
// Use milliseconds consistently (network timestamp is in ms)
export const MARKET_LOCKOUT_MS = UInt64.from(30 * 60 * 1000); // 30 minutes in ms

/**
 * FEE_BASIS_POINTS: Fee taken from winner claims
 * 20 basis points = 0.2%
 * Formula: fee = (amount * FEE_BASIS_POINTS) / BASIS_POINTS_DIVISOR
 */
export const FEE_BASIS_POINTS = Field(20); // 0.2%
export const BASIS_POINTS_DIVISOR = Field(10000); // 100.00%

/**
 * FEE_DISTRIBUTION:
 * - 20% to market creator
 * - 50% burned
 * - 50% kept by platform
 * (Percentages apply to collected fees)
 */
export const CREATOR_FEE_SHARE = Field(20); // 20%
export const BURN_FEE_SHARE = Field(50); // 50%
export const PLATFORM_FEE_SHARE = Field(50); // 50%
export const PERCENTAGE_DIVISOR = Field(100); // 100%

/**
 * DOOT_SUPPORTED_ASSETS: Asset indices matching Doot Oracle token array
 * 0: MINA, 1: BTC, 2: ETH, 3: SOL, 4: XRP, 5: ADA, 6: AVAX, 7: MATIC, 8: LINK, 9: DOGE
 */
export const ASSET_INDEX = {
  MINA: Field(0),
  BITCOIN: Field(1),
  ETHEREUM: Field(2),
  SOLANA: Field(3),
  RIPPLE: Field(4),
  CARDANO: Field(5),
  AVALANCHE: Field(6),
  POLYGON: Field(7),
  CHAINLINK: Field(8),
  DOGECOIN: Field(9),
} as const;

/**
 * MAX_ASSET_INDEX: Maximum valid asset index (9 for 10 supported assets)
 */
export const MAX_ASSET_INDEX = Field(9);

/**
 * MARKET_STATUS: Enum-like Field values for market states
 * Used for tracking market lifecycle
 */
export const MARKET_STATUS = {
  ACTIVE: Field(0),      // Market is accepting bets
  LOCKED: Field(1),      // Within lockout period, no new bets
  AWAITING: Field(2),    // Past end time, waiting for Doot settlement
  SETTLED: Field(3),     // Settlement complete, claims available
} as const;

/**
 * OUTCOME: Prediction outcome values
 */
export const OUTCOME = {
  PENDING: Field(0),     // Not yet settled
  YES: Field(1),         // YES won
  NO: Field(2),          // NO won
} as const;

/**
 * MINIMUM_BET: Absolute minimum bet amount
 * Set to 0.1 MINA as per spec (entry minimum)
 * 0.1 MINA = 100,000,000 nanomina
 */
// MVP aligns with idea.md: allow 1 nanomina minimum
export const MINIMUM_BET = UInt64.from(1); // 1 nanomina

/**
 * TIME_CONSTRAINTS: Min/max market duration
 * V1 MVP: Support 1-30 day markets with normalized economics
 * - Minimum: 1 day (86400 seconds)
 * - Maximum: 30 days (2592000 seconds)
 */
// Durations in milliseconds
export const MIN_MARKET_DURATION_MS = UInt64.from(24 * 60 * 60 * 1000);   // 1 day
export const MAX_MARKET_DURATION_MS = UInt64.from(30 * 24 * 60 * 60 * 1000);  // 30 days

/**
 * V1 FEE STRUCTURE:
 * - Base fee: 0.2% on every bet (bet-time, not claim-time)
 * - Late fee: 0-20% based on time remaining + pool imbalance
 * - Fee distribution: 50% treasury, 50% burn
 */
export const BASE_FEE_BPS = UInt64.from(20); // 0.2% (20 basis points)
export const MAX_LATE_FEE_BPS = UInt64.from(2000); // 20% max late fee

/**
 * SWITCH POSITION HAIRCUT:
 * - Early (τ ≥ 0.50): 15%
 * - Late (τ < 0.50): 25%
 * - Distribution: 50% treasury, 50% burn
 */
export const EARLY_HAIRCUT_BPS = UInt64.from(1500); // 15%
export const LATE_HAIRCUT_BPS = UInt64.from(2500); // 25%

/**
 * V1 FEE DISTRIBUTION (simplified from V1):
 * - 50% to treasury (protocol operations)
 * - 50% to burn address (supply reduction)
 * Note: Creator fee removed in V1 (protocol-operated markets only)
 */
export const TREASURY_FEE_SHARE = Field(50); // 50%
export const BURN_FEE_SHARE_V1 = Field(50); // 50%
