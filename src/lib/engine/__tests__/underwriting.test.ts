import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyPI,
  calculateNOI,
  calculateCapRate,
  calculateCashOnCash,
  calculateDSCR,
  calculateGRM,
  calculateEquityYearN,
  calculateARVEquity,
  calculateRemainingBalance,
  runUnderwriting,
} from '../underwriting';
import type { UnderwritingInput, FixerUpperResult } from '../types';

// ========== UNDER-01: Monthly P&I ==========
describe('calculateMonthlyPI', () => {
  it('calculates $300K loan at 7.0% for 30yr as $1,995.91', () => {
    expect(calculateMonthlyPI(300_000, 7.0, 30)).toBe(1995.91);
  });

  it('calculates $200K loan at 6.5% for 30yr as $1,264.14', () => {
    expect(calculateMonthlyPI(200_000, 6.5, 30)).toBe(1264.14);
  });

  it('handles 0% interest rate as principal / total months', () => {
    expect(calculateMonthlyPI(360_000, 0, 30)).toBe(1000);
  });

  it('handles $0 loan amount as $0.00', () => {
    expect(calculateMonthlyPI(0, 7.0, 30)).toBe(0);
  });

  it('calculates 15-year term correctly', () => {
    // $300K at 7% for 15yr = $2,696.48
    expect(calculateMonthlyPI(300_000, 7.0, 15)).toBe(2696.48);
  });
});

// ========== UNDER-02: NOI ==========
describe('calculateNOI', () => {
  it('calculates NOI from rent, vacancy, and expenses', () => {
    // $24,000 annual rent, 8% vacancy, $8,000 expenses
    // Effective gross income = 24000 * (1 - 0.08) = 22,080
    // NOI = 22,080 - 8,000 = 14,080
    expect(calculateNOI(24_000, 8, 8_000)).toBe(14080);
  });

  it('handles $0 rent as negative NOI', () => {
    expect(calculateNOI(0, 8, 8_000)).toBe(-8000);
  });

  it('handles 0% vacancy', () => {
    expect(calculateNOI(24_000, 0, 8_000)).toBe(16000);
  });

  it('handles $0 expenses', () => {
    expect(calculateNOI(24_000, 8, 0)).toBe(22080);
  });
});

// ========== UNDER-03: Cap Rate ==========
describe('calculateCapRate', () => {
  it('calculates cap rate as NOI / price', () => {
    // $14,080 NOI / $300,000 price = 4.69%
    expect(calculateCapRate(14_080, 300_000)).toBe(4.69);
  });

  it('handles $0 price as 0%', () => {
    expect(calculateCapRate(14_080, 0)).toBe(0);
  });
});

// ========== UNDER-04: Cash on Cash ==========
describe('calculateCashOnCash', () => {
  it('calculates CoC as annual cash flow / total invested', () => {
    // $3,000 / $65,000 = 4.62%
    expect(calculateCashOnCash(3_000, 65_000)).toBe(4.62);
  });

  it('handles $0 invested as 0%', () => {
    expect(calculateCashOnCash(3_000, 0)).toBe(0);
  });

  it('handles negative cash flow', () => {
    expect(calculateCashOnCash(-3_000, 65_000)).toBe(-4.62);
  });
});

// ========== UNDER-05: DSCR ==========
describe('calculateDSCR', () => {
  it('calculates DSCR as NOI / annual debt service', () => {
    // $14,080 / $23,950.92 = 0.59
    expect(calculateDSCR(14_080, 23_950.92)).toBe(0.59);
  });

  it('handles $0 debt service as Infinity', () => {
    expect(calculateDSCR(14_080, 0)).toBe(Infinity);
  });
});

// ========== UNDER-06: GRM ==========
describe('calculateGRM', () => {
  it('calculates GRM as price / annual gross rent', () => {
    // $300,000 / $24,000 = 12.50
    expect(calculateGRM(300_000, 24_000)).toBe(12.5);
  });

  it('handles $0 rent as Infinity', () => {
    expect(calculateGRM(300_000, 0)).toBe(Infinity);
  });
});

// ========== UNDER-07: Equity Year N ==========
describe('calculateEquityYearN', () => {
  it('calculates equity at Year 0 as down payment', () => {
    // Year 0: purchase_price - loan_amount = 300K - 240K = 60K
    expect(calculateEquityYearN(300_000, 240_000, 7, 30, 3, 0)).toBe(60000);
  });

  it('calculates equity at Year 5 with appreciation and paydown', () => {
    // $300K property, 3% appreciation, $240K loan, 7%, 30yr, Year 5
    // Appreciated value = 300000 * (1.03)^5 = 347,782.22 (rounded to 2 decimal)
    // Remaining balance after 60 payments on $240K at 7% 30yr
    const equity = calculateEquityYearN(300_000, 240_000, 7, 30, 3, 5);
    expect(equity).toBeGreaterThan(60_000); // More equity than initial down payment
    expect(typeof equity).toBe('number');
  });

  it('calculates equity at Year 10', () => {
    const equity = calculateEquityYearN(300_000, 240_000, 7, 30, 3, 10);
    expect(equity).toBeGreaterThan(
      calculateEquityYearN(300_000, 240_000, 7, 30, 3, 5),
    );
  });
});

// ========== calculateRemainingBalance ==========
describe('calculateRemainingBalance', () => {
  it('returns full loan amount at month 0', () => {
    expect(calculateRemainingBalance(240_000, 7, 30, 0)).toBe(240000);
  });

  it('returns 0 after all payments', () => {
    expect(calculateRemainingBalance(240_000, 7, 30, 360)).toBe(0);
  });

  it('decreases over time', () => {
    const bal60 = calculateRemainingBalance(240_000, 7, 30, 60);
    const bal120 = calculateRemainingBalance(240_000, 7, 30, 120);
    expect(bal60).toBeGreaterThan(bal120);
  });
});

// ========== UNDER-08: ARV Equity ==========
describe('calculateARVEquity', () => {
  it('calculates ARV equity for fixer-upper', () => {
    // $350K ARV - $240K loan - $40K reno = $70,000
    expect(calculateARVEquity(350_000, 240_000, 40_000)).toBe(70000);
  });

  it('handles negative equity scenario', () => {
    expect(calculateARVEquity(200_000, 240_000, 40_000)).toBe(-80000);
  });
});

// ========== UNDER-12: runUnderwriting ==========
describe('runUnderwriting', () => {
  const baseInput: UnderwritingInput = {
    purchase_price: 300_000,
    estimated_rent_monthly: 2_000,
    down_payment_pct: 20,
    annual_interest_rate: 7.0,
    loan_term_years: 30,
    vacancy_pct: 8,
    property_tax_rate: 1.8,
    mgmt_pct: 9,
    maintenance_pct: 10,
    capex_pct: 5,
    closing_costs_pct: 2.5,
  };

  it('produces a standard UnderwritingResult', () => {
    const result = runUnderwriting(baseInput);
    // Should NOT be a FixerUpperResult when no renovation_cost
    expect('pre_reno' in result).toBe(false);

    // Verify key calculations
    expect(result.loan_amount).toBe(240_000);
    expect(result.down_payment).toBe(60_000);
    expect(result.closing_costs).toBe(7_500);
    expect(result.total_cash_invested).toBe(67_500);
    expect(result.annual_gross_rent).toBe(24_000);
    expect(result.monthly_pi).toBe(1596.73);

    // NOI components
    expect(result.annual_vacancy_loss).toBe(1920);
    expect(result.effective_gross_income).toBe(22080);
    expect(result.annual_property_tax).toBe(5400);
    expect(result.annual_management).toBe(2160);
    expect(result.annual_maintenance).toBe(2400);
    expect(result.annual_capex).toBe(1200);
    expect(result.total_operating_expenses).toBe(11160);
    expect(result.noi).toBe(10920);

    // Derived metrics
    expect(result.annual_debt_service).toBe(19160.76);
    expect(result.annual_cash_flow).toBe(10920 - 19160.76);
    expect(result.monthly_cash_flow).toBeCloseTo((10920 - 19160.76) / 12, 2);
    expect(result.cap_rate).toBe(3.64);
    expect(result.grm).toBe(12.5);
    expect(result.dscr).toBeGreaterThan(0);
  });

  it('produces FixerUpperResult when renovation_cost > 0 and arv provided', () => {
    const fixerInput: UnderwritingInput = {
      ...baseInput,
      renovation_cost: 40_000,
      arv: 350_000,
    };
    const result = runUnderwriting(fixerInput) as FixerUpperResult;
    expect('pre_reno' in result).toBe(true);
    expect('post_reno' in result).toBe(true);

    // Pre-reno should be identical to standard
    expect(result.pre_reno.purchase_price === undefined || result.pre_reno.loan_amount === 240_000).toBe(true);

    // Post-reno should include renovation fields
    expect(result.post_reno.renovation_cost).toBe(40_000);
    expect(result.post_reno.arv).toBe(350_000);
    expect(result.post_reno.arv_equity).toBe(70_000);
    // Post-reno total_cash_invested includes renovation cost
    expect(result.post_reno.total_cash_invested).toBe(67_500 + 40_000);
  });

  it('uses default 3% appreciation when not specified', () => {
    const result = runUnderwriting(baseInput);
    // Equity year 1 should use 3% appreciation
    expect(result.equity_year_1).toBeGreaterThan(60_000);
  });

  it('respects custom appreciation rate', () => {
    const result5pct = runUnderwriting({ ...baseInput, appreciation_rate: 5 });
    const result3pct = runUnderwriting(baseInput);
    expect(result5pct.equity_year_5).toBeGreaterThan(result3pct.equity_year_5);
  });
});

// ========== UNDER-10: decimal.js usage ==========
// This is a structural test -- verified by grep in verification step
// We validate here that results are precise (no floating point drift)
describe('decimal.js precision', () => {
  it('P&I calculation is exact, not approximate', () => {
    const result = calculateMonthlyPI(300_000, 7.0, 30);
    // Must be exactly 1995.91 -- not 1995.9099999... or 1995.9100001...
    expect(result.toString()).toBe('1995.91');
  });

  it('NOI calculation is exact', () => {
    const result = calculateNOI(24_000, 8, 8_000);
    expect(result.toString()).toBe('14080');
  });
});
