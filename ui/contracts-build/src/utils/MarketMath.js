/**
 * MarketMath.ts - AMM pricing and fee calculation utilities
 *
 * Implements linear AMM pricing model and proportional payout calculations.
 * All math avoids decimals using multiplication factors.
 */
import { UInt64, Provable } from 'o1js';
import { FEE_BASIS_POINTS, BASIS_POINTS_DIVISOR, CREATOR_FEE_SHARE, BURN_FEE_SHARE, PLATFORM_FEE_SHARE, PERCENTAGE_DIVISOR, } from '../types/Constants.js';
/**
 * Linear AMM Pricing Model
 *
 * Price is determined by the ratio of pools:
 * YES price = yesPool / (yesPool + noPool)
 * NO price = noPool / (yesPool + noPool)
 *
 * Since we can't divide in ZK easily, we use a different approach:
 * We calculate how many tokens you get for a given amount.
 *
 * Simple linear model:
 * When you buy YES tokens, yesPool increases, making YES more expensive
 * When you buy NO tokens, noPool increases, making NO more expensive
 *
 * Tokens received = amount (1:1 ratio for initial implementation)
 * This creates a simple linear market where price doesn't change
 * but settlement is still based on actual outcome.
 */
export class MarketMath {
    /**
     * Calculate tokens received for a purchase
     *
     * AMM PRICING MODEL (as per spec):
     * - If YES is oversold (large YES pool), YES tokens become expensive (fewer tokens per MINA)
     * - If YES is undersold (small YES pool), YES tokens are cheap (more tokens per MINA)
     *
     * Formula: tokens = amount * (totalPool / targetPool)
     * - targetPool = pool user is buying into (YES or NO)
     * - If targetPool is large → tokens received is small (expensive)
     * - If targetPool is small → tokens received is large (cheap)
     *
     * @param amount - Amount of MINA to spend (in nanomina)
     * @param yesPool - Current YES pool size
     * @param noPool - Current NO pool size
     * @param buyYes - True if buying YES, false if buying NO
     * @returns Tokens to mint for user
     */
    static calculateTokensReceived(amount, yesPool, noPool, buyYes) {
        // Verify pools are non-zero
        yesPool.assertGreaterThan(UInt64.zero, 'YES pool cannot be zero');
        noPool.assertGreaterThan(UInt64.zero, 'NO pool cannot be zero');
        // Total pool size
        const totalPool = yesPool.add(noPool);
        // Select target pool based on which side user is buying
        const targetPool = Provable.if(buyYes, yesPool, noPool);
        // Calculate tokens: amount * totalPool / targetPool
        // More in target pool → higher division → fewer tokens (expensive)
        // Less in target pool → lower division → more tokens (cheap)
        const numerator = amount.mul(totalPool);
        const tokens = numerator.div(targetPool);
        return tokens;
    }
    /**
     * Calculate user's proportional share of winning pool
     *
     * Formula: userPayout = (userAmount / totalWinningPool) * totalPool
     *
     * Since we can't divide easily, we rearrange:
     * userPayout = (userAmount * totalPool) / totalWinningPool
     *
     * @param userAmount - User's winning position amount
     * @param totalWinningPool - Total amount in winning pool
     * @param totalPool - Combined YES + NO pools
     * @returns Amount user should receive
     */
    static calculateProportionalPayout(userAmount, totalWinningPool, totalPool) {
        // Prevent division by zero
        totalWinningPool.assertGreaterThan(UInt64.zero, 'Total winning pool cannot be zero');
        // Calculate: (userAmount * totalPool) / totalWinningPool
        const numerator = userAmount.mul(totalPool);
        const payout = numerator.div(totalWinningPool);
        return payout;
    }
    /**
     * Calculate platform fee from winning claim
     *
     * Fee = 0.2% = (amount * 20) / 10000
     *
     * @param amount - Claim amount
     * @returns Fee to deduct
     */
    static calculatePlatformFee(amount) {
        // Convert UInt64 to Field for multiplication
        const amountField = amount.value;
        const feeField = amountField.mul(FEE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
        // Convert back to UInt64
        return UInt64.Unsafe.fromField(feeField);
    }
    /**
     * Distribute collected fees
     *
     * @param totalFees - Total fees collected from all claims
     * @returns [creatorAmount, burnAmount, platformAmount]
     */
    static distributeFees(totalFees) {
        const feesField = totalFees.value;
        // Creator gets 20% of fees
        const creatorField = feesField.mul(CREATOR_FEE_SHARE).div(PERCENTAGE_DIVISOR);
        const creatorAmount = UInt64.Unsafe.fromField(creatorField);
        // Remaining 80% split between burn and platform (50/50)
        const remaining = totalFees.sub(creatorAmount);
        const remainingField = remaining.value;
        const burnField = remainingField.mul(BURN_FEE_SHARE).div(PERCENTAGE_DIVISOR);
        const burnAmount = UInt64.Unsafe.fromField(burnField);
        const platformField = remainingField.mul(PLATFORM_FEE_SHARE).div(PERCENTAGE_DIVISOR);
        const platformAmount = UInt64.Unsafe.fromField(platformField);
        return {
            creator: creatorAmount,
            burn: burnAmount,
            platform: platformAmount,
        };
    }
    /**
     * Calculate net claim amount after fees
     *
     * @param grossAmount - Total amount user won
     * @returns Net amount after 0.2% fee
     */
    static calculateNetClaim(grossAmount) {
        const fee = this.calculatePlatformFee(grossAmount);
        return grossAmount.sub(fee);
    }
    /**
     * Verify pool invariants
     * Both pools must always have positive amounts
     */
    static verifyPoolInvariants(yesPool, noPool) {
        yesPool.assertGreaterThan(UInt64.zero);
        noPool.assertGreaterThan(UInt64.zero);
    }
}
/**
 * Helper function: Safe UInt64 addition with overflow check
 */
export function safeAdd(a, b) {
    const result = a.add(b);
    // Ensure no overflow (result should be >= both operands)
    result.assertGreaterThanOrEqual(a);
    result.assertGreaterThanOrEqual(b);
    return result;
}
/**
 * Helper function: Safe UInt64 subtraction with underflow check
 */
export function safeSub(a, b) {
    // Ensure a >= b to prevent underflow
    a.assertGreaterThanOrEqual(b);
    return a.sub(b);
}
//# sourceMappingURL=MarketMath.js.map