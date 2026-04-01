export interface UnderwritingInput {
  // Property
  purchase_price: number;
  estimated_rent_monthly: number;
  // Loan
  down_payment_pct: number;
  annual_interest_rate: number;
  loan_term_years: number;
  // Assumptions (from user settings)
  vacancy_pct: number;
  property_tax_rate: number;
  mgmt_pct: number;
  maintenance_pct: number;
  capex_pct: number;
  closing_costs_pct: number;
  // Optional: appreciation and fixer-upper
  appreciation_rate?: number; // default 3%
  renovation_cost?: number; // > 0 triggers fixer-upper mode
  arv?: number; // after-repair value
}

export interface UnderwritingResult {
  // Core metrics
  monthly_pi: number;
  annual_debt_service: number;
  noi: number;
  cap_rate: number;
  cash_on_cash: number;
  dscr: number;
  grm: number;
  // Cash flow
  monthly_cash_flow: number;
  annual_cash_flow: number;
  // Investment
  loan_amount: number;
  down_payment: number;
  closing_costs: number;
  total_cash_invested: number;
  // Equity projections
  equity_year_1: number;
  equity_year_3: number;
  equity_year_5: number;
  equity_year_10: number;
  // Operating expenses breakdown
  annual_property_tax: number;
  annual_management: number;
  annual_maintenance: number;
  annual_capex: number;
  annual_vacancy_loss: number;
  total_operating_expenses: number;
  // Gross income
  annual_gross_rent: number;
  effective_gross_income: number;
}

export interface FixerUpperResult {
  pre_reno: UnderwritingResult;
  post_reno: UnderwritingResult & {
    renovation_cost: number;
    arv: number;
    arv_equity: number;
  };
}

export interface DealScoreInput {
  coc_return: number; // 0-100 scaled
  cap_rate: number; // 0-100 scaled
  five_year_equity: number; // 0-100 scaled
  market_score: number; // 0-100
  value_add_score: number; // 0-100
  comp_score: number; // 0-100
}

export interface DealScoreResult {
  score: number; // 0-100
  verdict: 'GO' | 'CAUTIOUS GO' | 'NO';
  breakdown: {
    coc_weighted: number;
    cap_rate_weighted: number;
    equity_weighted: number;
    market_weighted: number;
    value_add_weighted: number;
    comp_weighted: number;
  };
}
