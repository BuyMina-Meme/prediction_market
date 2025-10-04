/**
 * MarketMath.ts - AMM pricing and fee calculation utilities
 *
 * Implements linear AMM pricing model and proportional payout calculations.
 * All math avoids decimals using multiplication factors.
 */
import { UInt64, Bool } from 'o1js';
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
export declare class MarketMath {
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
    static calculateTokensReceived(amount: UInt64, yesPool: UInt64, noPool: UInt64, buyYes: Bool): UInt64;
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
    static calculateProportionalPayout(userAmount: UInt64, totalWinningPool: UInt64, totalPool: UInt64): UInt64;
    /**
     * Calculate platform fee from winning claim
     *
     * Fee = 0.2% = (amount * 20) / 10000
     *
     * @param amount - Claim amount
     * @returns Fee to deduct
     */
    static calculatePlatformFee(amount: UInt64): UInt64;
    /**
     * Distribute collected fees
     *
     * @param totalFees - Total fees collected from all claims
     * @returns [creatorAmount, burnAmount, platformAmount]
     */
    static distributeFees(totalFees: UInt64): {
        creator: UInt64;
        burn: UInt64;
        platform: UInt64;
    };
    /**
     * Calculate net claim amount after fees
     *
     * @param grossAmount - Total amount user won
     * @returns Net amount after 0.2% fee
     */
    static calculateNetClaim(grossAmount: UInt64): UInt64;
    /**
     * Verify pool invariants
     * Both pools must always have positive amounts
     */
    static verifyPoolInvariants(yesPool: UInt64, noPool: UInt64): void;
}
/**
 * Helper function: Safe UInt64 addition with overflow check
 */
export declare function safeAdd(a: UInt64, b: UInt64): UInt64;
/**
 * Helper function: Safe UInt64 subtraction with underflow check
 */
export declare function safeSub(a: UInt64, b: UInt64): UInt64;
