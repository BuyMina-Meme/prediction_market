/**
 * V1 Fee Calculation Utilities
 *
 * Client-side helpers for calculating and displaying V1 bet-time fees
 */

export interface FeeBreakdown {
  baseFee: number;        // 0.2% in MINA
  lateFee: number;        // 0-20% in MINA
  totalFee: number;       // Total fees in MINA
  netReceived: number;    // Shares received after fees
  effectiveRate: number;  // Total fee as percentage (0-20.2%)
  timeFeeRate: number;    // Time component (0-8%)
  imbalanceFeeRate: number; // Imbalance component (0-5%)
}

/**
 * Calculate time-based fee rate (τ normalization)
 *
 * τ = remaining / totalDuration
 * - τ ≥ 0.50: 0%
 * - 0.20-0.50: 1.5%
 * - 0.10-0.20: 3%
 * - 0.05-0.10: 5%
 * - τ < 0.05: 8%
 */
export function calculateTimeFeeRate(
  remaining: number,   // milliseconds
  totalDuration: number // milliseconds
): number {
  const tau = remaining / totalDuration;

  if (tau >= 0.50) return 0;
  if (tau >= 0.20) return 1.5;
  if (tau >= 0.10) return 3;
  if (tau >= 0.05) return 5;
  return 8;
}

/**
 * Calculate imbalance-based fee rate
 *
 * poolRatio = min(yesPool, noPool) / max(yesPool, noPool)
 * imbalanceFee = (1 - poolRatio) × 0.05
 *
 * Examples:
 * - 50/50 pools: ratio = 1.0 → fee = 0%
 * - 70/30 pools: ratio = 0.43 → fee = 2.85%
 * - 90/10 pools: ratio = 0.11 → fee = 4.45%
 */
export function calculateImbalanceFeeRate(
  yesPool: number,  // in MINA
  noPool: number    // in MINA
): number {
  const smaller = Math.min(yesPool, noPool);
  const larger = Math.max(yesPool, noPool);

  if (larger === 0) return 0; // Avoid division by zero

  const poolRatio = smaller / larger;
  const imbalanceFee = (1 - poolRatio) * 5; // 5% max

  return Math.min(imbalanceFee, 5); // Cap at 5%
}

/**
 * Calculate total late fee (time + imbalance, capped at 20%)
 */
export function calculateLateFeeRate(
  remaining: number,
  totalDuration: number,
  yesPool: number,
  noPool: number
): number {
  const timeFee = calculateTimeFeeRate(remaining, totalDuration);
  const imbalanceFee = calculateImbalanceFeeRate(yesPool, noPool);
  const totalLateFee = timeFee + imbalanceFee;

  return Math.min(totalLateFee, 20); // Cap at 20%
}

/**
 * Calculate complete fee breakdown for a bet
 *
 * @param betAmount - Amount user wants to bet (in MINA)
 * @param yesPool - Current YES pool size (in MINA)
 * @param noPool - Current NO pool size (in MINA)
 * @param remaining - Time remaining until market end (in ms)
 * @param totalDuration - Total market duration (in ms)
 * @returns Complete fee breakdown
 */
export function calculateBetFees(
  betAmount: number,
  yesPool: number,
  noPool: number,
  remaining: number,
  totalDuration: number
): FeeBreakdown {
  // Base fee: 0.2%
  const baseFee = betAmount * 0.002;
  const netAfterBase = betAmount - baseFee;

  // Late fee components
  const timeFeeRate = calculateTimeFeeRate(remaining, totalDuration);
  const imbalanceFeeRate = calculateImbalanceFeeRate(yesPool, noPool);
  const lateFeeRate = Math.min(timeFeeRate + imbalanceFeeRate, 20);

  // Late fee amount
  const lateFee = netAfterBase * (lateFeeRate / 100);
  const totalFee = baseFee + lateFee;
  const netReceived = betAmount - totalFee;

  // Effective rate
  const effectiveRate = (totalFee / betAmount) * 100;

  return {
    baseFee,
    lateFee,
    totalFee,
    netReceived,
    effectiveRate,
    timeFeeRate,
    imbalanceFeeRate,
  };
}

/**
 * Get pool ratio (smaller / larger)
 */
export function getPoolRatio(yesPool: number, noPool: number): number {
  const smaller = Math.min(yesPool, noPool);
  const larger = Math.max(yesPool, noPool);
  if (larger === 0) return 1;
  return smaller / larger;
}

/**
 * Get imbalance severity level for UI warnings
 */
export function getImbalanceSeverity(poolRatio: number): 'none' | 'low' | 'medium' | 'high' | 'extreme' {
  if (poolRatio >= 0.8) return 'none';      // 80%+ balanced
  if (poolRatio >= 0.5) return 'low';       // 50-80% balanced
  if (poolRatio >= 0.3) return 'medium';    // 30-50% balanced
  if (poolRatio >= 0.15) return 'high';     // 15-30% balanced
  return 'extreme';                         // <15% balanced (very lopsided)
}

/**
 * Get time urgency level for UI warnings
 */
export function getTimeUrgency(tau: number): 'none' | 'low' | 'medium' | 'high' | 'extreme' {
  if (tau >= 0.5) return 'none';      // ≥50% time remaining
  if (tau >= 0.2) return 'low';       // 20-50% remaining
  if (tau >= 0.1) return 'medium';    // 10-20% remaining
  if (tau >= 0.05) return 'high';     // 5-10% remaining
  return 'extreme';                   // <5% remaining (final hours)
}

/**
 * Format fee rate as percentage string
 */
export function formatFeeRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * Format MINA amount with precision
 */
export function formatMina(amount: number): string {
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.01) return amount.toFixed(3);
  return amount.toFixed(4);
}

/**
 * Get warning message for pool imbalance
 */
export function getImbalanceWarning(severity: 'none' | 'low' | 'medium' | 'high' | 'extreme'): string | null {
  switch (severity) {
    case 'none':
      return null;
    case 'low':
      return 'Pools slightly imbalanced (+0.5-1% fee)';
    case 'medium':
      return 'Pools moderately imbalanced (+2-3.5% fee)';
    case 'high':
      return 'Pools heavily imbalanced (+3.5-4.3% fee)';
    case 'extreme':
      return '⚠️ Extreme imbalance! High fees (+4.3-5% fee)';
  }
}

/**
 * Get warning message for time urgency
 */
export function getTimeWarning(urgency: 'none' | 'low' | 'medium' | 'high' | 'extreme'): string | null {
  switch (urgency) {
    case 'none':
      return null;
    case 'low':
      return 'Late bet window (+1.5% urgency fee)';
    case 'medium':
      return 'Very late bet (+3% urgency fee)';
    case 'high':
      return 'Extremely late bet (+5% urgency fee)';
    case 'extreme':
      return '⚠️ Final hours! Maximum urgency fee (+8%)';
  }
}
