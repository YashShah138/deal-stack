import { describe, it, expect } from 'vitest';
import { calculateDealScore } from '../deal-score';
import type { DealScoreInput } from '../types';

// ========== UNDER-09: Deal Score ==========
describe('calculateDealScore', () => {
  it('returns 50 when all inputs are 50', () => {
    const input: DealScoreInput = {
      coc_return: 50,
      cap_rate: 50,
      five_year_equity: 50,
      market_score: 50,
      value_add_score: 50,
      comp_score: 50,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(50);
    expect(result.verdict).toBe('CAUTIOUS GO');
    // Verify breakdown
    expect(result.breakdown.coc_weighted).toBe(12.5); // 50 * 0.25
    expect(result.breakdown.cap_rate_weighted).toBe(10); // 50 * 0.20
    expect(result.breakdown.equity_weighted).toBe(10); // 50 * 0.20
    expect(result.breakdown.market_weighted).toBe(7.5); // 50 * 0.15
    expect(result.breakdown.value_add_weighted).toBe(5); // 50 * 0.10
    expect(result.breakdown.comp_weighted).toBe(5); // 50 * 0.10
  });

  it('returns 0 when all inputs are 0', () => {
    const input: DealScoreInput = {
      coc_return: 0,
      cap_rate: 0,
      five_year_equity: 0,
      market_score: 0,
      value_add_score: 0,
      comp_score: 0,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('NO');
  });

  it('returns 100 when all inputs are 100', () => {
    const input: DealScoreInput = {
      coc_return: 100,
      cap_rate: 100,
      five_year_equity: 100,
      market_score: 100,
      value_add_score: 100,
      comp_score: 100,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('GO');
  });

  it('returns GO for score >= 70', () => {
    const input: DealScoreInput = {
      coc_return: 70,
      cap_rate: 70,
      five_year_equity: 70,
      market_score: 70,
      value_add_score: 70,
      comp_score: 70,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(70);
    expect(result.verdict).toBe('GO');
  });

  it('returns CAUTIOUS GO for score >= 50 and < 70', () => {
    const input: DealScoreInput = {
      coc_return: 60,
      cap_rate: 60,
      five_year_equity: 60,
      market_score: 60,
      value_add_score: 60,
      comp_score: 60,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(60);
    expect(result.verdict).toBe('CAUTIOUS GO');
  });

  it('returns NO for score < 50', () => {
    const input: DealScoreInput = {
      coc_return: 30,
      cap_rate: 30,
      five_year_equity: 30,
      market_score: 30,
      value_add_score: 30,
      comp_score: 30,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(30);
    expect(result.verdict).toBe('NO');
  });

  it('clamps score to 0-100 range', () => {
    const input: DealScoreInput = {
      coc_return: 150,
      cap_rate: 150,
      five_year_equity: 150,
      market_score: 150,
      value_add_score: 150,
      comp_score: 150,
    };
    const result = calculateDealScore(input);
    expect(result.score).toBe(100);
  });

  it('produces correct weighted sum for mixed inputs', () => {
    const input: DealScoreInput = {
      coc_return: 80, // * 0.25 = 20
      cap_rate: 60, // * 0.20 = 12
      five_year_equity: 40, // * 0.20 = 8
      market_score: 90, // * 0.15 = 13.5
      value_add_score: 20, // * 0.10 = 2
      comp_score: 70, // * 0.10 = 7
    };
    const result = calculateDealScore(input);
    // 20 + 12 + 8 + 13.5 + 2 + 7 = 62.5
    expect(result.score).toBe(62.5);
    expect(result.verdict).toBe('CAUTIOUS GO');
  });
});
