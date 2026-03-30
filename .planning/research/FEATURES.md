# Feature Research

**Domain:** Real Estate Investment Analysis SaaS (Buy-and-Hold Focus)
**Researched:** 2026-03-30
**Confidence:** MEDIUM (based on training data knowledge of competitors through early 2025; no live verification available)

## Competitor Landscape Overview

The real estate investment tool market is fragmented by workflow stage:

- **Lead generation / property discovery:** DealMachine (driving for dollars, skip tracing), PropStream (filters + owner data), BatchLeads
- **Market analytics / rental estimates:** Mashvisor (short-term vs long-term rental analysis), Rentometer, AirDNA (STR-specific)
- **Underwriting calculators:** BiggerPockets Rental Property Calculator, DealCheck, REIPro
- **Portfolio tracking:** Stessa (income/expense tracking, tax-ready reports), Baselane, Landlord Studio
- **Turnkey marketplace:** Roofstock (buy already-tenanted properties with Roofstock-certified inspections)
- **Full stack (discovery through portfolio):** None do this well end-to-end. Most investors cobble together 3-4 tools.

DealStack's opportunity: the gap between "find a property" and "manage a property" is where serious investors spend the most manual effort and where no single tool dominates.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or amateurish.

#### Property Data & Search

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Property detail lookup by address | Every competitor does this; it is the atomic unit of the product | LOW | Rentcast API covers this. Cache aggressively. |
| Rent estimate (market rent) | Investors cannot underwrite without knowing expected rent; Mashvisor, PropStream, Rentcast all provide this | LOW | Rentcast rent estimate endpoint. Show confidence range, not just point estimate. |
| Sale comps (recent sold properties nearby) | Needed for ARV and offer price validation; standard in every tool | MEDIUM | Rentcast comps endpoint. Show on map + in table. Distance and recency matter. |
| Rental comps (nearby active/recent rentals) | Validates rent estimate; serious investors do not trust a single number | MEDIUM | Rentcast rental comps. Show by bedroom count, distance, recency. |
| Property tax and assessed value | Critical input to underwriting; public record data | LOW | Rentcast property detail includes this. |
| Basic property characteristics (beds, baths, sqft, year built, lot size) | Users need this to evaluate at a glance | LOW | Rentcast property detail. |

#### Underwriting & Financial Analysis

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mortgage calculator (P&I with amortization) | Every calculator has this; investors think in terms of monthly payment | LOW | Pure math. Must handle different loan terms (15/20/30yr), ARM vs fixed. |
| Cash flow projection (monthly NOI after debt service) | The single most important number for buy-and-hold investors | LOW | NOI minus P&I. Show monthly and annual. |
| Cap rate calculation | Universal metric; investors use it to compare deals regardless of financing | LOW | NOI / Purchase Price. Trivial but must be prominent. |
| Cash-on-cash return (CoC) | The metric that matters most to leveraged buy-and-hold investors | LOW | Annual cash flow / total cash invested. Must include closing costs + rehab in denominator. |
| Operating expense breakdown | Users need to see and adjust: taxes, insurance, management, vacancy, maintenance, CapEx reserves | MEDIUM | Must be editable per-deal AND have smart defaults from user profile. BiggerPockets calculator does this well. |
| DSCR (Debt Service Coverage Ratio) | Required by DSCR lenders; increasingly common financing path for investors | LOW | NOI / Annual debt service. Flag deals below 1.0 and 1.25 thresholds. |
| Gross Rent Multiplier (GRM) | Quick screening metric used by experienced investors | LOW | Purchase price / Gross annual rent. |
| Deal score / verdict (go/no-go) | Users expect a synthesized recommendation, not just raw numbers; DealCheck and Mashvisor both provide this | MEDIUM | Weighted composite score. The weighting methodology IS the product opinion. |

#### Deal Pipeline & Organization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Save / bookmark properties | Cannot use the tool without saving interesting finds | LOW | CRUD on a deals table. |
| Pipeline stages (prospect through acquired/pass) | Investors evaluating multiple deals simultaneously need status tracking; Stessa and DealMachine both have pipeline concepts | MEDIUM | Kanban board UI. 5-6 stages max. Must be drag-and-drop. |
| Notes per deal | Investors jot observations during drive-bys, phone calls with agents | LOW | Rich text or markdown on deal record. |
| Side-by-side deal comparison | When narrowing from 5 prospects to 2 offers, comparison view is essential | MEDIUM | Table comparing key metrics across 2-4 deals. BiggerPockets and DealCheck both offer this. |

#### Reports & Output

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PDF export of analysis | Investors share with partners, lenders, mentors; every serious calculator exports PDF | HIGH | Puppeteer/Playwright rendering. Two modes: internal (dense) and external (clean). |
| Shareable deal summary | Not every stakeholder wants to log in; a link or PDF must be sendable | MEDIUM | Either public link with token or PDF attachment. |

#### User Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Customizable underwriting assumptions | Every investor has different tax rates, management fees, vacancy assumptions by market | MEDIUM | Per-user defaults that pre-fill but can be overridden per deal. This is critical UX. |
| Target market / criteria settings | Users should not have to re-enter their search criteria every session | LOW | Stored user preferences for market, price range, property type, bedroom count. |

---

### Differentiators (Competitive Advantage)

Features that set DealStack apart. Not required, but valuable enough to command premium pricing or win over serious investors.

#### AI-Powered Automation

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Agentic property discovery (Finder Agent) | No competitor auto-finds listings matching criteria. PropStream has filters but requires manual search. DealMachine requires driving around. Automated discovery with AI web search is genuinely novel. | HIGH | Claude web_search for active listings. Quality of results will vary. Must have human-in-the-loop approval before spending API calls on underwriting. |
| AI market narrative (Market Analysis Agent) | Competitors show numbers; DealStack explains them. "Population grew 4.2% while housing starts lagged, creating rental demand pressure" is dramatically more useful than a table of census data. | HIGH | Census + Walk Score + web_search synthesized into prose. This is where LLMs genuinely shine over traditional tools. |
| AI underwriting with scenario analysis | Auto-populating a full proforma from an address (instead of manually entering 15+ fields) saves 20-30 minutes per deal. No competitor does this. | HIGH | The orchestration of data fetch + assumption application + proforma generation as a single action. |
| AI-generated investment memo | Professional-quality PDF reports that look like institutional investment memos. BiggerPockets gives you a spreadsheet export. DealStack gives you something you could hand to a private lender. | HIGH | Verdict Agent narrative + structured data + professional PDF layout. |
| Scheduled discovery runs (cron + email digest) | "Set it and forget it" deal finding. Investors currently check Zillow/Redfin daily. Automated alerts with pre-screening are high-value. | MEDIUM | Cron trigger + Finder Agent + email via Resend. The email must be scannable (not a wall of text). |

#### Underwriting Depth

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fixer-upper / renovation scenario (ARV analysis) | Serious investors buy distressed properties. Need to model: purchase price + rehab cost vs ARV. BiggerPockets BRRRR calculator does this but as a separate tool. Inline scenario toggle is better. | MEDIUM | Add rehab cost and ARV fields. Recalculate equity position and refinance analysis. |
| Multi-year equity projection with appreciation | Buy-and-hold is a 5-30 year strategy. Showing year-by-year equity buildup (principal paydown + appreciation) is powerful for conviction. Few tools visualize this well. | MEDIUM | Amortization schedule + configurable appreciation rate. Chart showing equity curve over time. |
| Sensitivity analysis (what-if on key variables) | "What if vacancy is 12% instead of 8%?" or "What if rates go up 1%?" Sophisticated investors always stress-test. No consumer tool does this elegantly. | MEDIUM | Slider or table showing how CoC/cash flow changes across a range of one variable. |
| Rent vs buy-and-hold vs BRRRR comparison | Same property, different strategies. Helps investors see which approach maximizes returns for their capital. | HIGH | Multiple proformas for same property with different assumptions. Complex but high-value for sophisticated users. |

#### Portfolio Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Portfolio-level metrics (total equity, total cash flow, weighted cap rate) | Stessa does income/expense tracking. DealStack can show portfolio performance against investment thesis. | MEDIUM | Aggregate across all Acquired deals. Show progress toward acquisition goal. |
| Acquisition goal tracking with projections | "You're 2 of 5 properties toward your goal. At current pace, you'll hit 5 by Q3 2028." Motivating and strategic. | LOW | Simple projection from current pace + goal. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| MLS integration / IDX feed | "Show me every listing" | MLS data requires broker license, IDX compliance, NAR rules. Expensive ($500-2000/mo), legally complex, and turns you into a listing portal competing with Zillow. The data is also delayed vs what agents see. | AI web search finds listings without MLS licensing. Users can paste any URL/address. Partner with agents rather than replacing them. |
| Skip tracing / owner contact info | DealMachine's core feature; off-market investors want it | Requires purchasing data from skip trace providers ($0.10-0.50/record). Creates legal liability (TCPA compliance for cold outreach). Moves product toward wholesaling, not buy-and-hold. | Focus on on-market deal analysis. Off-market is a different product for a different user. |
| Built-in CRM with call tracking, drip campaigns | "I need to follow up with sellers" | CRM is a deep product category. Building a mediocre CRM dilutes focus. Investors already use Podio, REsimpli, or generic CRMs. | Pipeline/kanban for deal tracking (not contact tracking). Integrate or export to existing CRMs. |
| Short-term rental (Airbnb) analysis | Mashvisor and AirDNA do this; users will ask for it | STR underwriting is fundamentally different: seasonal occupancy, dynamic pricing, furnishing costs, local regulation risk, higher management fees. Building it properly is a full product. Doing it poorly misleads investors. | Clearly position as buy-and-hold / long-term rental tool. If STR demand is validated post-launch, build as dedicated module with AirDNA-level data, not a checkbox toggle. |
| Property management features (tenant screening, maintenance requests, lease tracking) | "I bought the property, now help me manage it" | This is Stessa/Baselane/Buildium territory. Deep operational product with completely different data models. Dilutes the analysis focus. | Portfolio tracking shows acquired properties and their performance. Link out to Stessa/Baselane for operational management. |
| Automated offer generation / contract creation | "Let me make an offer from the app" | Legal documents require state-specific templates, attorney review, e-signature integration. Massive liability. | Show "suggested offer price" based on analysis. User works with their agent/attorney for actual offers. |
| Real-time property alerts from MLS | "Alert me the second a property hits the market" | Requires MLS access (see above). Even if you had it, competing on speed with Redfin/Zillow notifications is a losing battle. | Scheduled discovery runs (daily/weekly) that find and pre-screen. Speed matters less when you add analysis value. |
| Social features (forums, deal sharing, community) | BiggerPockets community is powerful | Community building is a full-time product challenge. Moderation, engagement, content -- none of this is DealStack's core value. | Focus on shareable reports. An investor shares a DealStack PDF in their existing communities (BiggerPockets forums, local REI groups, mastermind Slack). |
| Wholesaling tools (assignment contracts, disposition lists, marketing) | Large segment of RE investors wholesale | Wholesaling is a transaction business, not an analysis business. Different user, different workflow, different legal considerations. Muddies the buy-and-hold positioning. | Stay focused on buy-and-hold. Wholesalers have DealMachine, REIPro, BatchLeads. |

---

## Feature Dependencies

```
[Property Data Lookup]
    |
    +--requires--> [Rentcast API Integration + Caching Layer]
    |
    +--enables--> [Rent Estimate]
    +--enables--> [Sale Comps]
    +--enables--> [Rental Comps]
    +--enables--> [Underwriting Engine]
                      |
                      +--requires--> [User Assumptions/Settings]
                      +--requires--> [Mortgage Calculator (P&I)]
                      |
                      +--enables--> [Cash Flow Projection]
                      +--enables--> [Cap Rate / CoC / DSCR / GRM]
                      +--enables--> [Deal Score / Verdict]
                      +--enables--> [Multi-year Equity Projection]
                      +--enables--> [Sensitivity Analysis]
                      +--enables--> [PDF Report Generation]
                                        |
                                        +--requires--> [Deal Score / Verdict]
                                        +--requires--> [Market Analysis]
                                        +--enhances--> [Shareable Deal Summary]

[Market Analysis Agent]
    +--requires--> [Census API Integration]
    +--requires--> [Walk Score API Integration]
    +--requires--> [Geocoder Integration]
    +--enhances--> [Deal Score / Verdict]
    +--enhances--> [PDF Report]

[Finder Agent]
    +--requires--> [User Target Market Settings]
    +--requires--> [Claude web_search]
    +--enables--> [Scheduled Discovery + Email Digest]
    +--enables--> [Pipeline Population]

[Deal Pipeline (Kanban)]
    +--requires--> [Save/Bookmark Properties]
    +--enables--> [Side-by-Side Comparison]
    +--enables--> [Portfolio Tracking] (Acquired stage feeds portfolio)

[Portfolio Tracking]
    +--requires--> [Deal Pipeline] (Acquired deals)
    +--requires--> [Underwriting Data] (for performance metrics)
    +--enables--> [Acquisition Goal Tracking]
    +--enables--> [Portfolio-level Metrics]
```

### Dependency Notes

- **Underwriting Engine requires Rentcast + User Settings:** Cannot produce a proforma without property data and investor-specific assumptions. These must be built first.
- **PDF Report requires Verdict + Market Analysis:** The professional memo synthesizes all analysis layers. It is the last thing built in the analysis chain.
- **Finder Agent requires User Settings:** Discovery criteria come from user profile (market, price ceiling, property type). Settings must exist first.
- **Portfolio Tracking requires Pipeline:** Only "Acquired" deals flow into the portfolio. Pipeline stages must exist.
- **Sensitivity Analysis enhances Underwriting but is independent:** Can be added after core underwriting without refactoring.

---

## What a Professional Investment Memo Includes

Based on institutional real estate investment memo standards (the kind private equity firms and commercial lenders produce), adapted for residential buy-and-hold:

### Internal Memo (Dense, Decision-Focused)
1. **Executive Summary** -- Property address, asking price, recommended offer, deal score, GO/NO verdict, 1-paragraph rationale
2. **Property Overview** -- Type, beds/baths/sqft, year built, lot size, condition assessment, photos if available
3. **Market Analysis** -- Submarket demographics (population, income, growth), employment drivers, walk/transit/bike scores, rental market conditions, supply pipeline
4. **Financial Analysis** -- Full proforma: income, expenses line-by-line, NOI, debt service, cash flow, cap rate, CoC, DSCR, GRM
5. **Comparable Analysis** -- Sale comps table (address, price, sqft, price/sqft, date, distance) + rental comps table (address, rent, beds, sqft, distance)
6. **Return Projections** -- 5-year equity buildup table (year, mortgage balance, estimated value with appreciation, equity, cumulative cash flow)
7. **Risk Factors** -- Market risks, property-specific risks, assumption sensitivity
8. **Renovation Scenario** (if applicable) -- Rehab budget, ARV, post-rehab proforma, BRRRR refinance analysis

### External Memo (Clean, Shareable)
Same content but:
- Branded header (investor name/logo when available)
- Cleaner typography, more white space
- Executive summary more prominent
- Risk factors framed constructively ("considerations" not "risks")
- Suitable for sharing with lenders, partners, or co-investors

---

## MVP Definition

### Launch With (Phase 0 - Single User)

- [ ] Property lookup by address (Rentcast) -- the atomic action everything depends on
- [ ] Full underwriting engine with all metrics (P&I, NOI, cap rate, CoC, DSCR, GRM, equity projection) -- this IS the product
- [ ] User-configurable assumptions (per-user defaults + per-deal overrides) -- makes underwriting personal
- [ ] Sale and rental comps display -- validates the numbers
- [ ] Market analysis (Census + Walk Score + AI narrative) -- differentiator from day one
- [ ] Deal score with AI verdict -- the synthesized recommendation
- [ ] Deal pipeline (Kanban: Prospect > Analyzed > Offer Made > Acquired > Pass) -- organize the workflow
- [ ] PDF report generation (internal + external modes) -- the deliverable investors actually use
- [ ] Finder Agent with manual trigger -- the discovery differentiator
- [ ] Dashboard with pipeline summary and recent activity -- the home screen

### Add After Validation (Phase 0.x)

- [ ] Scheduled Finder runs + email digest -- once manual Finder is validated as useful
- [ ] Side-by-side deal comparison view -- once users have 3+ deals in pipeline
- [ ] Fixer-upper / ARV scenario toggle -- once base underwriting is solid
- [ ] Sensitivity analysis (what-if sliders) -- once users trust the base numbers
- [ ] Portfolio aggregate metrics -- once users have Acquired deals

### Future Consideration (Phase 1+ SaaS)

- [ ] Multi-year equity projection charts -- rich visualization, not MVP
- [ ] Rent vs BRRRR strategy comparison -- requires validated base underwriting
- [ ] White-label external PDFs (custom branding per user) -- SaaS tier feature
- [ ] Team accounts with shared pipelines -- SaaS tier feature
- [ ] API access for power users -- SaaS tier feature
- [ ] Webhook integrations (notify when deal hits criteria) -- after email digest is validated

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Property lookup by address | HIGH | LOW | P1 |
| Underwriting engine (all metrics) | HIGH | MEDIUM | P1 |
| User-configurable assumptions | HIGH | MEDIUM | P1 |
| Sale + rental comps | HIGH | LOW | P1 |
| Market analysis (Census + Walk Score + AI) | HIGH | HIGH | P1 |
| Deal score + AI verdict | HIGH | MEDIUM | P1 |
| Deal pipeline (Kanban) | HIGH | MEDIUM | P1 |
| PDF report (internal + external) | HIGH | HIGH | P1 |
| Finder Agent (manual trigger) | HIGH | HIGH | P1 |
| Dashboard | MEDIUM | MEDIUM | P1 |
| Notes per deal | MEDIUM | LOW | P1 |
| Scheduled Finder + email digest | HIGH | MEDIUM | P2 |
| Side-by-side comparison | MEDIUM | MEDIUM | P2 |
| ARV / renovation scenario | MEDIUM | MEDIUM | P2 |
| Sensitivity analysis | MEDIUM | MEDIUM | P2 |
| Portfolio aggregate metrics | MEDIUM | LOW | P2 |
| Acquisition goal tracking | LOW | LOW | P2 |
| Multi-year equity charts | MEDIUM | MEDIUM | P3 |
| Strategy comparison (rent vs BRRRR) | LOW | HIGH | P3 |
| White-label PDFs | LOW | MEDIUM | P3 |
| Team accounts | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for Phase 0 launch
- P2: Add during Phase 0.x iteration once core is validated
- P3: Phase 1+ SaaS features

---

## Competitor Feature Analysis

| Feature | BiggerPockets Calculator | DealCheck | PropStream | Mashvisor | Stessa | DealStack Approach |
|---------|------------------------|-----------|------------|-----------|--------|-------------------|
| Property data | Manual entry | Manual + some auto | Rich (MLS + public records) | Auto (MLS-sourced) | Manual entry | Auto via Rentcast API |
| Rent estimate | Manual entry | Basic auto | Yes (algorithm) | Yes (ML model, LTR + STR) | N/A (expense tracker) | Rentcast estimate + rental comps |
| Underwriting | Good calculator, all manual | Good calculator, some auto-fill | Basic (cap rate, cash flow) | Basic (cash flow, CoC) | N/A | Full proforma, AI-populated from address |
| Market analysis | None | None | County-level stats | Neighborhood heatmaps | None | Census + Walk Score + AI narrative per property |
| Deal score | None | None | "Deal analyzer" basic | Investment score | None | Weighted composite + AI verdict with rationale |
| Comps | None | Manual entry | Yes (MLS) | Yes (limited) | None | Rentcast sale + rental comps, auto-fetched |
| PDF report | Basic spreadsheet export | Clean PDF export | None | None | Tax-ready reports (different) | Professional investment memo (institutional quality) |
| Pipeline/CRM | None | Basic deal list | Lead pipeline | None | Property list | Kanban pipeline with stage tracking |
| Portfolio tracking | None | None | None | None | Yes (income/expense/tax) | Aggregate metrics from Acquired deals |
| Property discovery | None | None | Filters + lists | Heatmap exploration | None | AI agent with web search (novel) |
| AI/automation | None | None | None | None | Auto-categorize transactions | AI agents for every stage (discovery, analysis, verdict) |
| Pricing | $39/mo | $14-29/mo | $99/mo | $35-75/mo | Free (basic) / $12/mo (pro) | Phase 0: free (single-user). Phase 1: TBD |

### Key Competitive Insights

1. **No competitor does end-to-end with AI.** Each tool handles 1-2 stages well. The closest to "full stack" is PropStream but it is a data platform, not an analysis platform.

2. **Underwriting is either fully manual or overly simplified.** BiggerPockets and DealCheck make you enter everything. Mashvisor and PropStream auto-fill some fields but have shallow analysis. DealStack's "address to full proforma" automation is genuinely differentiated.

3. **Market analysis is a gap.** No consumer tool provides Census-level demographic analysis tied to a specific property. This is something institutional investors do manually. Automating it is a real value-add.

4. **PDF quality is low across the board.** DealCheck has the best PDF export in the consumer space and it is still just a formatted spreadsheet. An institutional-quality investment memo is a clear differentiator.

5. **Portfolio tracking is Stessa's domain** and they do it well for income/expense tracking. DealStack should not try to replace Stessa for tax prep and expense categorization. Instead, focus on portfolio-level investment performance (equity growth, CoC trends, goal progress).

---

## Pipeline/CRM Features for Tracking 5-20 Deals

Based on what serious investors managing multiple simultaneous deals need:

### Must Have
- **Kanban board** with drag-and-drop between stages (Prospect / Analyzed / Offer Made / Under Contract / Acquired / Pass)
- **Quick-glance metrics per card** (price, estimated cash flow, deal score, days in stage)
- **Sorting and filtering** by score, price, cash flow, date added, stage
- **Activity log per deal** (when analyzed, when score changed, when stage changed)
- **Notes** (free-text per deal for agent conversations, inspection notes, etc.)

### Nice to Have (P2)
- **Deadline/reminder tracking** (inspection deadline, financing contingency, closing date)
- **Bulk actions** (mark multiple deals as Pass, export comparison of selected deals)
- **Pipeline analytics** (conversion rate by stage, average days in stage, total deals analyzed this month)

### Explicitly NOT Needed
- Contact management (agents, sellers, lenders) -- use a real CRM
- Task management per deal -- use existing task tools
- Document storage per deal -- use Google Drive / Dropbox
- Communication tracking (calls, emails) -- CRM territory

---

## Sources

- Competitor product knowledge based on training data through early 2025 (MEDIUM confidence -- features and pricing may have changed)
- BiggerPockets Rental Property Calculator: well-known community standard for buy-and-hold analysis
- DealCheck: popular mobile-first deal analysis calculator
- PropStream: data-heavy platform primarily used for lead generation and skip tracing
- Mashvisor: analytics platform with STR vs LTR comparison as core differentiator
- Stessa: portfolio tracking and income/expense management (acquired by Roofstock)
- Roofstock: turnkey rental property marketplace with inspection/certification model
- DealMachine: driving-for-dollars + skip tracing tool for off-market deal finding
- Professional investment memo format based on commercial real estate underwriting standards

**Confidence note:** All competitor feature analysis is based on training data. Individual feature availability, pricing tiers, and recent additions/removals should be verified against current product pages before making final product decisions. Core patterns (what categories of features exist, what users expect) are stable and HIGH confidence. Specific feature-by-feature accuracy of competitors is MEDIUM confidence.

---
*Feature research for: Real Estate Investment Analysis SaaS (Buy-and-Hold)*
*Researched: 2026-03-30*
