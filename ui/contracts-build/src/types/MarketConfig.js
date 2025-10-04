/**
 * MarketConfig.ts - Market configuration and parameters
 *
 * Defines the core parameters for a prediction market including
 * the asset being predicted, price threshold, and timing.
 */
import { Struct, Field, UInt64 } from 'o1js';
import { MAX_ASSET_INDEX, MIN_MARKET_DURATION, MAX_MARKET_DURATION, MINIMUM_BET, } from './Constants.js';
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
export class MarketConfig extends Struct({
    assetIndex: Field, // Asset to track (0-9)
    priceThreshold: Field, // Price threshold (Doot format: price * 10^10)
    endTimestamp: Field, // Market end time (unix seconds)
    minBet: UInt64, // Minimum bet (nanomina)
}) {
    /**
     * Validates market configuration
     * Ensures all parameters are within acceptable ranges
     */
    validate(currentTimestamp) {
        // Asset index must be 0-9 (10 supported assets)
        this.assetIndex.assertLessThanOrEqual(MAX_ASSET_INDEX);
        this.assetIndex.assertGreaterThanOrEqual(Field(0));
        // Price threshold must be positive
        this.priceThreshold.assertGreaterThan(Field(0));
        // End timestamp must be in the future
        this.endTimestamp.assertGreaterThan(currentTimestamp);
        // Market duration must be between 1-7 days
        const duration = this.endTimestamp.sub(currentTimestamp);
        duration.assertGreaterThanOrEqual(MIN_MARKET_DURATION);
        duration.assertLessThanOrEqual(MAX_MARKET_DURATION);
        // Minimum bet must be at least 1 nanomina
        this.minBet.assertGreaterThanOrEqual(MINIMUM_BET);
    }
    /**
     * Check if market is past end time
     */
    isPastEndTime(currentTimestamp) {
        return currentTimestamp.greaterThan(this.endTimestamp);
    }
    /**
     * Check if market is in lockout period (30 min before end)
     */
    isInLockoutPeriod(currentTimestamp, lockoutSeconds) {
        const lockoutStart = this.endTimestamp.sub(lockoutSeconds);
        const isAfterLockout = currentTimestamp.greaterThanOrEqual(lockoutStart);
        const isBeforeEnd = currentTimestamp.lessThan(this.endTimestamp);
        return isAfterLockout.and(isBeforeEnd);
    }
    /**
     * Check if betting is allowed at current time
     */
    isBettingAllowed(currentTimestamp, lockoutSeconds) {
        const isBeforeLockout = currentTimestamp.lessThan(this.endTimestamp.sub(lockoutSeconds));
        return isBeforeLockout;
    }
}
// Re-export for convenience
export { Struct, Field, UInt64, Bool } from 'o1js';
//# sourceMappingURL=MarketConfig.js.map