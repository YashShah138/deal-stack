import Decimal from 'decimal.js';
import type { UnderwritingInput, UnderwritingResult, FixerUpperResult } from './types';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * UNDER-01: Monthly Principal & Interest payment
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyPI(
  loanAmount: number,
  annualRate: number,
  termYears: number,
): number {
  const P = new Decimal(loanAmount);
  if (P.isZero()) return 0;

  const n = new Decimal(termYears).times(12);
  const annualRateDec = new Decimal(annualRate);

  if (annualRateDec.isZero()) {
    return P.dividedBy(n).toDecimalPlaces(2).toNumber();
  }

  const r = annualRateDec.dividedBy(100).dividedBy(12);
  const onePlusR = r.plus(1);
  const onePlusRPowN = onePlusR.pow(n);
  const numerator = P.times(r).times(onePlusRPowN);
  const denominator = onePlusRPowN.minus(1);

  return numerator.dividedBy(denominator).toDecimalPlaces(2).toNumber();
}

/**
 * UNDER-02: Net Operating Income
 * NOI = (annual_rent * (1 - vacancy_pct/100)) - operating_expenses
 */
export function calculateNOI(
  annualRent: number,
  vacancyPct: number,
  operatingExpenses: number,
): number {
  const rent = new Decimal(annualRent);
  const vacancy = new Decimal(vacancyPct).dividedBy(100);
  const expenses = new Decimal(operatingExpenses);

  const effectiveIncome = rent.times(new Decimal(1).minus(vacancy));
  return effectiveIncome.minus(expenses).toDecimalPlaces(2).toNumber();
}

/**
 * UNDER-03: Capitalization Rate
 * Cap Rate = (NOI / purchase_price) * 100
 */
export function calculateCapRate(noi: number, purchasePrice: number): number {
  const price = new Decimal(purchasePrice);
  if (price.isZero()) return 0;

  return new Decimal(noi)
    .dividedBy(price)
    .times(100)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * UNDER-04: Cash-on-Cash Return
 * CoC = (annual_cash_flow / total_cash_invested) * 100
 */
export function calculateCashOnCash(
  annualCashFlow: number,
  totalCashInvested: number,
): number {
  const invested = new Decimal(totalCashInvested);
  if (invested.isZero()) return 0;

  return new Decimal(annualCashFlow)
    .dividedBy(invested)
    .times(100)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * UNDER-05: Debt Service Coverage Ratio
 * DSCR = NOI / annual_debt_service
 */
export function calculateDSCR(
  noi: number,
  annualDebtService: number,
): number {
  const debt = new Decimal(annualDebtService);
  if (debt.isZero()) return Infinity;

  return new Decimal(noi)
    .dividedBy(debt)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * UNDER-06: Gross Rent Multiplier
 * GRM = purchase_price / annual_gross_rent
 */
export function calculateGRM(
  purchasePrice: number,
  annualGrossRent: number,
): number {
  const rent = new Decimal(annualGrossRent);
  if (rent.isZero()) return Infinity;

  return new Decimal(purchasePrice)
    .dividedBy(rent)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Calculate remaining loan balance after N months of payments.
 * B(k) = P * [(1+r)^n - (1+r)^k] / [(1+r)^n - 1]
 */
export function calculateRemainingBalance(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  monthsPaid: number,
): number {
  const P = new Decimal(loanAmount);
  if (P.isZero()) return 0;

  const n = new Decimal(termYears).times(12);
  const k = new Decimal(monthsPaid);

  if (k.greaterThanOrEqualTo(n)) return 0;
  if (k.isZero()) return P.toNumber();

  const annualRateDec = new Decimal(annualRate);
  if (annualRateDec.isZero()) {
    return P.minus(P.times(k).dividedBy(n)).toDecimalPlaces(2).toNumber();
  }

  const r = annualRateDec.dividedBy(100).dividedBy(12);
  const onePlusR = r.plus(1);
  const onePlusRPowN = onePlusR.pow(n);
  const onePlusRPowK = onePlusR.pow(k);

  const numerator = onePlusRPowN.minus(onePlusRPowK);
  const denominator = onePlusRPowN.minus(1);

  return P.times(numerator).dividedBy(denominator).toDecimalPlaces(2).toNumber();
}

/**
 * UNDER-07: Equity at Year N
 * Equity = appreciated_value - remaining_balance
 * appreciated_value = purchase_price * (1 + appreciation_rate/100)^year
 */
export function calculateEquityYearN(
  purchasePrice: number,
  loanAmount: number,
  annualRate: number,
  termYears: number,
  appreciationRate: number,
  year: number,
): number {
  const price = new Decimal(purchasePrice);
  const appRate = new Decimal(appreciationRate).dividedBy(100);
  const onePlusApp = appRate.plus(1);

  const appreciatedValue = price.times(onePlusApp.pow(new Decimal(year)));
  const monthsPaid = new Decimal(year).times(12).toNumber();
  const remainingBal = new Decimal(
    calculateRemainingBalance(loanAmount, annualRate, termYears, monthsPaid),
  );

  return appreciatedValue.minus(remainingBal).toDecimalPlaces(2).toNumber();
}

/**
 * UNDER-08: After-Repair Value Equity
 * ARV Equity = ARV - loan_amount - renovation_cost
 */
export function calculateARVEquity(
  arv: number,
  loanAmount: number,
  renovationCost: number,
): number {
  return new Decimal(arv)
    .minus(new Decimal(loanAmount))
    .minus(new Decimal(renovationCost))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * UNDER-12: Run full underwriting analysis
 * Returns UnderwritingResult or FixerUpperResult if renovation_cost > 0 and arv provided
 */
export function runUnderwriting(
  input: UnderwritingInput,
): UnderwritingResult | FixerUpperResult {
  const appreciationRate = input.appreciation_rate ?? 3;

  const result = computeScenario(input, input.purchase_price, appreciationRate, 0);

  // Fixer-upper mode
  if (
    input.renovation_cost !== undefined &&
    input.renovation_cost > 0 &&
    input.arv !== undefined
  ) {
    const postRenoResult = computeScenario(input, input.purchase_price, appreciationRate, input.renovation_cost);
    const arvEquity = calculateARVEquity(
      input.arv,
      postRenoResult.loan_amount,
      input.renovation_cost,
    );

    return {
      pre_reno: result,
      post_reno: {
        ...postRenoResult,
        renovation_cost: input.renovation_cost,
        arv: input.arv,
        arv_equity: arvEquity,
      },
    } as FixerUpperResult;
  }

  return result;
}

function computeScenario(
  input: UnderwritingInput,
  purchasePrice: number,
  appreciationRate: number,
  renovationCost: number,
): UnderwritingResult {
  const price = new Decimal(purchasePrice);
  const downPct = new Decimal(input.down_payment_pct).dividedBy(100);
  const closingPct = new Decimal(input.closing_costs_pct).dividedBy(100);

  const downPayment = price.times(downPct).toDecimalPlaces(2).toNumber();
  const loanAmount = price.times(new Decimal(1).minus(downPct)).toDecimalPlaces(2).toNumber();
  const closingCosts = price.times(closingPct).toDecimalPlaces(2).toNumber();
  const totalCashInvested = new Decimal(downPayment)
    .plus(new Decimal(closingCosts))
    .plus(new Decimal(renovationCost))
    .toDecimalPlaces(2)
    .toNumber();

  // Monthly P&I
  const monthlyPI = calculateMonthlyPI(
    loanAmount,
    input.annual_interest_rate,
    input.loan_term_years,
  );
  const annualDebtService = new Decimal(monthlyPI)
    .times(12)
    .toDecimalPlaces(2)
    .toNumber();

  // Income
  const annualGrossRent = new Decimal(input.estimated_rent_monthly)
    .times(12)
    .toDecimalPlaces(2)
    .toNumber();
  const vacancyLoss = new Decimal(annualGrossRent)
    .times(new Decimal(input.vacancy_pct).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
  const effectiveGrossIncome = new Decimal(annualGrossRent)
    .minus(new Decimal(vacancyLoss))
    .toDecimalPlaces(2)
    .toNumber();

  // Operating expenses (calculated on annual gross rent)
  const annualPropertyTax = price
    .times(new Decimal(input.property_tax_rate).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
  const annualManagement = new Decimal(annualGrossRent)
    .times(new Decimal(input.mgmt_pct).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
  const annualMaintenance = new Decimal(annualGrossRent)
    .times(new Decimal(input.maintenance_pct).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();
  const annualCapex = new Decimal(annualGrossRent)
    .times(new Decimal(input.capex_pct).dividedBy(100))
    .toDecimalPlaces(2)
    .toNumber();

  const totalOperatingExpenses = new Decimal(annualPropertyTax)
    .plus(new Decimal(annualManagement))
    .plus(new Decimal(annualMaintenance))
    .plus(new Decimal(annualCapex))
    .toDecimalPlaces(2)
    .toNumber();

  // NOI
  const noi = calculateNOI(annualGrossRent, input.vacancy_pct, totalOperatingExpenses);

  // Derived metrics
  const capRate = calculateCapRate(noi, purchasePrice);
  const annualCashFlow = new Decimal(noi)
    .minus(new Decimal(annualDebtService))
    .toDecimalPlaces(2)
    .toNumber();
  const monthlyCashFlow = new Decimal(annualCashFlow)
    .dividedBy(12)
    .toDecimalPlaces(2)
    .toNumber();
  const cashOnCash = calculateCashOnCash(annualCashFlow, totalCashInvested);
  const dscr = calculateDSCR(noi, annualDebtService);
  const grm = calculateGRM(purchasePrice, annualGrossRent);

  // Equity projections
  const equityYear1 = calculateEquityYearN(
    purchasePrice, loanAmount, input.annual_interest_rate, input.loan_term_years, appreciationRate, 1,
  );
  const equityYear3 = calculateEquityYearN(
    purchasePrice, loanAmount, input.annual_interest_rate, input.loan_term_years, appreciationRate, 3,
  );
  const equityYear5 = calculateEquityYearN(
    purchasePrice, loanAmount, input.annual_interest_rate, input.loan_term_years, appreciationRate, 5,
  );
  const equityYear10 = calculateEquityYearN(
    purchasePrice, loanAmount, input.annual_interest_rate, input.loan_term_years, appreciationRate, 10,
  );

  return {
    monthly_pi: monthlyPI,
    annual_debt_service: annualDebtService,
    noi,
    cap_rate: capRate,
    cash_on_cash: cashOnCash,
    dscr,
    grm,
    monthly_cash_flow: monthlyCashFlow,
    annual_cash_flow: annualCashFlow,
    loan_amount: loanAmount,
    down_payment: downPayment,
    closing_costs: closingCosts,
    total_cash_invested: totalCashInvested,
    equity_year_1: equityYear1,
    equity_year_3: equityYear3,
    equity_year_5: equityYear5,
    equity_year_10: equityYear10,
    annual_property_tax: annualPropertyTax,
    annual_management: annualManagement,
    annual_maintenance: annualMaintenance,
    annual_capex: annualCapex,
    annual_vacancy_loss: vacancyLoss,
    total_operating_expenses: totalOperatingExpenses,
    annual_gross_rent: annualGrossRent,
    effective_gross_income: effectiveGrossIncome,
  };
}
