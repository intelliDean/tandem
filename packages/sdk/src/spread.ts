/**
 * Spread Calculation Utilities
 * 
 * Consistent definition across frontend, executor, and smart contracts:
 * Adjusted Entry Spread = Perp Entry Price - Spot Entry Price - Total Fees Per MON
 * 
 * Standardized in AUSD/USDC (6 decimals) per 1.0 MON (18 decimals).
 */

export interface SpreadCalculationParams {
  perpPrice: bigint;       // Perp price scaled (e.g. 839083 = $83.9083 or scaled)
  spotSpentQuote: bigint;  // Quote tokens spent on spot buy (6 decimals)
  spotMonReceived: bigint; // Native MON wei received (18 decimals)
  totalFees: bigint;       // Service fee + trading venue fees in quote (6 decimals)
}

export function calculateAdjustedEntrySpread(params: SpreadCalculationParams): bigint {
  const { perpPrice, spotSpentQuote, spotMonReceived, totalFees } = params;

  if (spotMonReceived === 0n) {
    throw new Error('spotMonReceived cannot be 0');
  }

  // Spot price per 1.0 MON in quote units (6 decimals):
  // spotPriceQuote = (spotSpentQuote * 1e18) / spotMonReceived
  const spotPriceQuote = (spotSpentQuote * 10n ** 18n) / spotMonReceived;

  // Fee per 1.0 MON in quote units (6 decimals):
  const feePerMon = (totalFees * 10n ** 18n) / spotMonReceived;

  // Adjusted entry spread:
  return perpPrice - spotPriceQuote - feePerMon;
}

/**
 * Format raw spread bigint (6 decimals) to human-readable string:
 * e.g. 50000n -> "+0.050000"
 */
export function formatSpread(rawSpread: bigint): string {
  const isNegative = rawSpread < 0n;
  const absVal = isNegative ? -rawSpread : rawSpread;
  const whole = absVal / 1_000_000n;
  const frac = (absVal % 1_000_000n).toString().padStart(6, '0');
  const sign = isNegative ? '-' : '+';
  return `${sign}${whole}.${frac}`;
}
