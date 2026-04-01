import Decimal from 'decimal.js';
import type { DealScoreInput, DealScoreResult } from './types';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const WEIGHTS = {
  coc_return: new Decimal('0.25'),
  cap_rate: new Decimal('0.20'),
  five_year_equity: new Decimal('0.20'),
  market_score: new Decimal('0.15'),
  value_add_score: new Decimal('0.10'),
  comp_score: new Decimal('0.10'),
} as const;

/**
 * UNDER-09: Calculate weighted composite deal score
 * Weights: CoC 25%, cap rate 20%, 5yr equity 20%, market 15%, value-add 10%, comp 10%
 * Verdict: >= 70 GO, >= 50 CAUTIOUS GO, < 50 NO
 */
export function calculateDealScore(input: DealScoreInput): DealScoreResult {
  const cocWeighted = new Decimal(input.coc_return).times(WEIGHTS.coc_return);
  const capRateWeighted = new Decimal(input.cap_rate).times(WEIGHTS.cap_rate);
  const equityWeighted = new Decimal(input.five_year_equity).times(WEIGHTS.five_year_equity);
  const marketWeighted = new Decimal(input.market_score).times(WEIGHTS.market_score);
  const valueAddWeighted = new Decimal(input.value_add_score).times(WEIGHTS.value_add_score);
  const compWeighted = new Decimal(input.comp_score).times(WEIGHTS.comp_score);

  const rawScore = cocWeighted
    .plus(capRateWeighted)
    .plus(equityWeighted)
    .plus(marketWeighted)
    .plus(valueAddWeighted)
    .plus(compWeighted);

  const clampedScore = Decimal.max(0, Decimal.min(100, rawScore))
    .toDecimalPlaces(2)
    .toNumber();

  let verdict: 'GO' | 'CAUTIOUS GO' | 'NO';
  if (clampedScore >= 70) {
    verdict = 'GO';
  } else if (clampedScore >= 50) {
    verdict = 'CAUTIOUS GO';
  } else {
    verdict = 'NO';
  }

  return {
    score: clampedScore,
    verdict,
    breakdown: {
      coc_weighted: cocWeighted.toDecimalPlaces(2).toNumber(),
      cap_rate_weighted: capRateWeighted.toDecimalPlaces(2).toNumber(),
      equity_weighted: equityWeighted.toDecimalPlaces(2).toNumber(),
      market_weighted: marketWeighted.toDecimalPlaces(2).toNumber(),
      value_add_weighted: valueAddWeighted.toDecimalPlaces(2).toNumber(),
      comp_weighted: compWeighted.toDecimalPlaces(2).toNumber(),
    },
  };
}
