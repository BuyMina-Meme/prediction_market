/**
 * Position.ts - User betting position tracking
 *
 * Stores a user's YES and NO token holdings for a specific market.
 * This data is stored in offchain state to avoid on-chain Field limits.
 */

import { Struct, UInt64, Bool, Provable } from 'o1js';

/**
 * Position: Represents a user's stake in a prediction market
 *
 * @property yesAmount - Amount of YES tokens held (in nanomina)
 * @property noAmount - Amount of NO tokens held (in nanomina)
 * @property claimed - Whether user has claimed their winnings (if applicable)
 * @property hasSwitched - Whether user has used their one-time position switch (V1 feature)
 *
 * Storage: Offchain state map (UserAddress → Position)
 *
 * Example:
 * - User bets 5 MINA on YES: yesAmount = 5000000000, noAmount = 0, hasSwitched = false
 * - User bets 3 MINA on NO: yesAmount = 0, noAmount = 3000000000, hasSwitched = false
 * - User bets both sides: yesAmount = 2000000000, noAmount = 1000000000, hasSwitched = false
 * - User switches NO→YES: yesAmount updated, noAmount reduced, hasSwitched = true (can't switch again)
 */
export class Position extends Struct({
  yesAmount: UInt64,  // Amount in YES pool (nanomina)
  noAmount: UInt64,   // Amount in NO pool (nanomina)
  claimed: Bool,      // Payout claimed flag
  hasSwitched: Bool,  // One-time switch used flag (V1)
}) {
  /**
   * Creates an empty position (no tokens held)
   */
  static empty(): Position {
    return new Position({
      yesAmount: UInt64.zero,
      noAmount: UInt64.zero,
      claimed: Bool(false),
      hasSwitched: Bool(false),
    });
  }

  /**
   * Check if position has any holdings
   */
  hasPosition(): Bool {
    const hasYes = this.yesAmount.greaterThan(UInt64.zero);
    const hasNo = this.noAmount.greaterThan(UInt64.zero);
    return hasYes.or(hasNo);
  }

  /**
   * Get total amount bet across both outcomes
   */
  totalBet(): UInt64 {
    return this.yesAmount.add(this.noAmount);
  }

  /**
   * Check if user can claim (has winning position and hasn't claimed)
   */
  canClaim(isYesWinner: Bool): Bool {
    const winningAmount = Provable.if(
      isYesWinner,
      this.yesAmount,
      this.noAmount
    );

    const hasWinningPosition = winningAmount.greaterThan(UInt64.zero);
    const hasNotClaimed = this.claimed.not();

    return hasWinningPosition.and(hasNotClaimed);
  }
}

// Re-export for convenience
export { Struct, UInt64, Bool } from 'o1js';
