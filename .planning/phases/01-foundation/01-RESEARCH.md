# Phase 1: Foundation - Research

**Researched:** 2026-03-30
**Domain:** Next.js 14 + Supabase + decimal.js financial math + Puppeteer serverless PDF
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire multi-tenant foundation: project scaffold, database schema with RLS, authentication, user settings, a TDD-built underwriting engine, and a Puppeteer PDF test harness validated on Vercel. This phase has zero external dependencies beyond Supabase and Vercel -- no AI agents, no external data APIs, no complex UI. The risk profile is well-defined: the hardest parts are (1) getting RLS correct on every table from day one, (2) achieving cent-level precision in financial math with decimal.js, and (3) proving Puppeteer works on Vercel serverless.

The research found that `@supabase/ssr` has evolved since initial stack research -- version 0.10.0 is current (vs 0.9.0 in STACK.md) and Supabase now recommends `getClaims()` over `getUser()` in middleware for performance (though `getUser()` remains correct for strict session validation). The `@sparticuz/chromium` + `puppeteer-core` pattern is well-documented by Vercel with an official template. Vitest integrates cleanly with Next.js 14 via `@vitejs/plugin-react`.

**Primary recommendation:** Build in strict plan order (scaffold -> auth -> settings -> underwriting TDD -> PDF harness). Each plan has a clear gate: schema verified, auth working, settings seeded, 100% test coverage, PDF renders on Vercel preview.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Admin account seeded on first deploy via ADMIN_EMAIL + ADMIN_PASSWORD env vars | Supabase `auth.admin.createUser()` with service role client; seed script pattern documented |
| AUTH-02 | Auth middleware protects all routes and API endpoints | `@supabase/ssr` middleware pattern with `getUser()` call and redirect logic |
| AUTH-03 | User session persists across browser refresh using Supabase Auth + @supabase/ssr | Cookie-based session via `createBrowserClient` + middleware token refresh |
| AUTH-04 | Row-Level Security enforced at database level on all user-scoped tables | RLS policy pattern with `auth.uid() = user_id` for USING + WITH CHECK |
| AUTH-05 | No public signup UI -- invite-only via admin-created accounts | No signup route; login page with email/password only |
| AUTH-06 | Permission model supports future plan tiers via users.plan enum field | `plan` enum column in users table; not enforced yet, schema-ready |
| DB-01 | Schema includes all 11 tables | Full SQL migration with all tables documented in this research |
| DB-02 | All user-data tables have user_id FK referencing auth.users(id) | Every user-scoped table has `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` |
| DB-03 | users table includes Stripe-ready fields | `stripe_customer_id`, `plan` enum, `plan_status`, `plan_limits` JSONB columns |
| DB-04 | users table includes usage tracking fields | `deals_analyzed_this_month`, `properties_tracked` integer columns |
| DB-05 | api_cache stores provider, key, response, timestamps | Cache table with `provider`, `cache_key`, `response_data` JSONB, `created_at`, `expires_at` |
| DB-06 | api_usage_log stores provider, endpoint, user_id, cache_hit | Usage log table with nullable `user_id` for global tracking |
| DB-07 | RLS enabled on every user-scoped table with all CRUD policies | `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + 4 policies per table |
| DB-08 | Shared cache data has no user_id -- globally shared | `api_cache` is global; RLS allows authenticated SELECT, service-role writes only |
| SETTINGS-01 | Per-user settings stored in user_settings table | `user_settings` table with `user_id` FK + full column set |
| SETTINGS-02 | Settings include market targeting fields | `target_market`, `target_submarkets` text[], `property_types` text[], `price_ceiling`, `down_payment_pct` |
| SETTINGS-03 | Settings include underwriting assumptions | `property_tax_rate`, `mgmt_pct`, `vacancy_pct`, `maintenance_pct`, `capex_pct`, `closing_costs_pct` as NUMERIC |
| SETTINGS-04 | Settings include goals and alert config | `acquisition_goal_count`, `acquisition_goal_years`, `alert_email`, `mortgage_rate_override` |
| SETTINGS-05 | Settings include cron and notification config | `finder_cron_interval`, `notification_preferences` JSONB |
| SETTINGS-06 | Settings include branding for external PDFs | `logo_url`, `accent_color` nullable text columns |
| SETTINGS-07 | Default settings seeded for admin user matching DFW investor profile | Seed script inserts defaults after admin user creation |
| UNDER-01 | Monthly P&I calculation unit tested against known amortization values | decimal.js implementation with known test vectors |
| UNDER-02 | NOI calculation unit tested | `(annual_rent * (1 - vacancy_rate)) - operating_expenses` in decimal.js |
| UNDER-03 | Cap Rate calculation unit tested | `NOI / purchase_price` in decimal.js |
| UNDER-04 | Cash-on-Cash Return unit tested | `annual_cash_flow / total_cash_invested` in decimal.js |
| UNDER-05 | DSCR calculation unit tested | `NOI / annual_debt_service` in decimal.js |
| UNDER-06 | GRM calculation unit tested | `purchase_price / annual_gross_rent` in decimal.js |
| UNDER-07 | Equity Year N unit tested | Appreciation + remaining loan balance calculation in decimal.js |
| UNDER-08 | ARV Equity for fixer-upper unit tested | `ARV - (loan_amount + renovation_cost)` in decimal.js |
| UNDER-09 | Deal Score weighted composite unit tested | CoC 25%, cap rate 20%, 5yr equity 20%, market 15%, value-add 10%, comp 10% |
| UNDER-10 | All financial math uses decimal.js | Every arithmetic operation uses Decimal class, never native `+ - * /` on dollars |
| UNDER-11 | Engine reads all assumptions from user settings | Function signature accepts settings object, zero hardcoded values |
| UNDER-12 | Fixer-upper mode generates pre-reno and post-reno scenarios | Dual-scenario output when renovation_cost > 0 |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | Full-stack framework (App Router) | Project constraint. Latest 14.2.x patch. |
| react / react-dom | 18.3.1 | UI library | Locked by Next.js 14. NOT React 19. |
| typescript | 5.5.4 | Type safety | Latest 5.5.x compatible with Next 14. |
| tailwindcss | 3.4.19 | CSS framework | Latest 3.x. NOT Tailwind 4.x. |
| @supabase/supabase-js | 2.101.0 | Database + Auth client | Latest 2.x. Use for all DB operations. |
| @supabase/ssr | 0.10.0 | Server-side auth for Next.js | Current version (updated from 0.9.0 in STACK.md). Replaces deprecated auth-helpers. |
| decimal.js | 10.6.0 | Arbitrary-precision financial math | IEEE 754 correctness for all monetary calculations. |
| puppeteer-core | 24.40.0 | PDF generation (no bundled Chromium) | Latest 24.x. Must use puppeteer-core, NOT puppeteer. |
| @sparticuz/chromium | 143.0.4 | Serverless Chromium binary | Only viable Chromium for Vercel. Tested pair with puppeteer-core@24. |
| zod | 3.25.76 | Schema validation | Use 3.x (not 4.x) to avoid ecosystem compatibility risk. |

### Dev Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| vitest | 4.1.2 | Unit testing framework |
| @vitest/coverage-v8 | 4.1.2 | Coverage reporting (V8-based, fast) |
| @vitejs/plugin-react | latest | Vitest React support |
| vite-tsconfig-paths | latest | Path alias resolution in Vitest |
| postcss | 8.x | CSS processing |
| autoprefixer | 10.x | CSS vendor prefixes |
| eslint | latest | Linting (eslint-config-next) |
| supabase (CLI) | 2.84.5 | Local dev DB, migrations, type gen |

### Installation Commands

```bash
# Project init
npx create-next-app@14.2.35 deal-stack --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Core dependencies
npm install @supabase/supabase-js@2 @supabase/ssr@0 decimal.js@10 zod@3

# PDF generation (Phase 1 plan 05 only)
npm install puppeteer-core@24 @sparticuz/chromium@143

# Dev dependencies
npm install -D vitest @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 Scope)

```
src/
  app/
    (auth)/
      login/page.tsx           # Login form (email/password)
      layout.tsx               # Unauthenticated layout
    api/
      reports/
        generate/route.ts      # PDF generation endpoint
    layout.tsx                 # Root layout
    page.tsx                   # Redirect to login or dashboard
  lib/
    supabase/
      client.ts                # createBrowserClient
      server.ts                # createServerClient (cookies)
      admin.ts                 # Service role client (seeds, cron)
      middleware.ts            # Supabase middleware helper
    engine/
      underwriting.ts          # Pure math functions (decimal.js)
      deal-score.ts            # Weighted composite scoring
      types.ts                 # Input/output types for engine
      __tests__/
        underwriting.test.ts   # TDD tests
        deal-score.test.ts     # TDD tests
    services/
      pdf-service.ts           # Puppeteer PDF generation
    types/
      database.ts              # Supabase generated types
  middleware.ts                # Next.js auth middleware
supabase/
  migrations/
    00001_initial_schema.sql   # All tables + RLS + policies
  seed.sql                     # Admin user + default settings (optional, prefer script)
scripts/
  seed-admin.ts                # Admin user seed script
vitest.config.ts               # Vitest configuration
```

### Pattern 1: Three Supabase Client Types

**What:** Every Supabase interaction uses the correct client type. Never mix them.

```typescript
// src/lib/supabase/client.ts — Browser client (Client Components)
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts — Server client (Server Components, Route Handlers, Server Actions)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from Server Components where cookies
            // cannot be set. This is safe to ignore — middleware handles refresh.
          }
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/admin.ts — Service role client (admin ops, seeds, cron)
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

### Pattern 2: Auth Middleware with getUser()

**What:** Middleware refreshes the Supabase session on every request and redirects unauthenticated users.

**Important note on getClaims() vs getUser():** Supabase now recommends `getClaims()` for middleware performance (it validates the JWT locally via JWKS rather than making an API call). However, `getUser()` is still the safer default because it verifies the session is active server-side (catches logouts). For Phase 1 with a single user, the performance difference is negligible. Use `getUser()` for safety.

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CRITICAL: Always call getUser() to refresh the session token.
  // Without this, the user's JWT expires and RLS queries fail silently.
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login (except auth routes)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Pattern 3: RLS Policy Template

**Every user-scoped table gets this exact pattern:**

```sql
-- Enable RLS (MUST be in every migration for user-scoped tables)
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- SELECT: users see only their own rows
CREATE POLICY "users_select_own_{table_name}"
  ON {table_name} FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can only insert rows for themselves
CREATE POLICY "users_insert_own_{table_name}"
  ON {table_name} FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own rows
CREATE POLICY "users_update_own_{table_name}"
  ON {table_name} FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own rows
CREATE POLICY "users_delete_own_{table_name}"
  ON {table_name} FOR DELETE
  USING (auth.uid() = user_id);
```

**Tables requiring user-scoped RLS:** `users` (profile extension), `user_settings`, `properties`, `deals`, `pipeline_stages`, `offers`, `comparables`, `analysis_results`, `pdf_reports`

**Tables with global RLS (no user_id):** `api_cache` (authenticated SELECT, service-role write), `api_usage_log` (authenticated SELECT, service-role INSERT)

### Pattern 4: Admin User Seed Script

```typescript
// scripts/seed-admin.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seedAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('Admin user already exists');
      return;
    }
    throw error;
  }

  console.log('Admin user created:', data.user.id);

  // Insert default DFW investor settings
  const { error: settingsError } = await supabase.from('user_settings').insert({
    user_id: data.user.id,
    target_market: 'DFW',
    target_submarkets: ['Arlington', 'Garland', 'Irving', 'Grand Prairie', 'Las Colinas'],
    property_types: ['SFR', 'Small Multifamily'],
    price_ceiling: 400000,
    down_payment_pct: 20,
    property_tax_rate: 1.8,
    mgmt_pct: 9,
    vacancy_pct: 8,
    maintenance_pct: 10,
    capex_pct: 5,
    closing_costs_pct: 2.5,
    acquisition_goal_count: 5,
    acquisition_goal_years: 5,
    alert_email: process.env.ADMIN_EMAIL!,
    mortgage_rate_override: null,
    finder_cron_interval: '1 day',
  });

  if (settingsError) throw settingsError;
  console.log('Default DFW settings seeded');
}

seedAdmin().catch(console.error);
```

### Pattern 5: Vitest Configuration for Next.js 14

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node', // underwriting engine is pure math, no DOM needed
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/engine/**/*.ts'],
      exclude: ['src/lib/engine/**/*.test.ts', 'src/lib/engine/**/types.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
```

### Pattern 6: decimal.js Financial Math

```typescript
// src/lib/engine/underwriting.ts
import Decimal from 'decimal.js';

// Configure decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Monthly P&I Payment
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * where r = monthly rate, n = total months
 */
export function calculateMonthlyPI(
  loanAmount: number,
  annualRate: number,
  termYears: number
): number {
  const P = new Decimal(loanAmount);
  const r = new Decimal(annualRate).div(100).div(12); // monthly rate
  const n = new Decimal(termYears).mul(12); // total months

  if (r.isZero()) {
    return P.div(n).toDecimalPlaces(2).toNumber();
  }

  // (1 + r)^n
  const onePlusR_n = r.plus(1).pow(n);
  // r * (1+r)^n
  const numerator = r.mul(onePlusR_n);
  // (1+r)^n - 1
  const denominator = onePlusR_n.minus(1);

  return P.mul(numerator).div(denominator).toDecimalPlaces(2).toNumber();
}

/**
 * Net Operating Income
 * NOI = (annual_rent * (1 - vacancy_rate)) - operating_expenses
 */
export function calculateNOI(
  annualRent: number,
  vacancyRate: number,
  operatingExpenses: number
): number {
  const rent = new Decimal(annualRent);
  const vacancy = new Decimal(vacancyRate).div(100);
  const expenses = new Decimal(operatingExpenses);

  return rent.mul(new Decimal(1).minus(vacancy)).minus(expenses).toDecimalPlaces(2).toNumber();
}

/**
 * Cap Rate = NOI / Purchase Price
 */
export function calculateCapRate(noi: number, purchasePrice: number): number {
  return new Decimal(noi).div(purchasePrice).mul(100).toDecimalPlaces(2).toNumber();
}

/**
 * Cash-on-Cash Return = Annual Cash Flow / Total Cash Invested
 */
export function calculateCashOnCash(annualCashFlow: number, totalCashInvested: number): number {
  if (totalCashInvested === 0) return 0;
  return new Decimal(annualCashFlow).div(totalCashInvested).mul(100).toDecimalPlaces(2).toNumber();
}

/**
 * DSCR = NOI / Annual Debt Service
 */
export function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService === 0) return Infinity;
  return new Decimal(noi).div(annualDebtService).toDecimalPlaces(2).toNumber();
}

/**
 * GRM = Purchase Price / Annual Gross Rent
 */
export function calculateGRM(purchasePrice: number, annualGrossRent: number): number {
  if (annualGrossRent === 0) return Infinity;
  return new Decimal(purchasePrice).div(annualGrossRent).toDecimalPlaces(2).toNumber();
}

/**
 * Remaining loan balance at year N using amortization formula
 * B(N) = P * [(1+r)^n - (1+r)^(N*12)] / [(1+r)^n - 1]
 */
export function calculateRemainingBalance(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  yearsElapsed: number
): number {
  const P = new Decimal(loanAmount);
  const r = new Decimal(annualRate).div(100).div(12);
  const n = new Decimal(termYears).mul(12);
  const p = new Decimal(yearsElapsed).mul(12); // payments made

  if (r.isZero()) {
    return P.minus(P.div(n).mul(p)).toDecimalPlaces(2).toNumber();
  }

  const onePlusR_n = r.plus(1).pow(n);
  const onePlusR_p = r.plus(1).pow(p);

  return P.mul(onePlusR_n.minus(onePlusR_p)).div(onePlusR_n.minus(1)).toDecimalPlaces(2).toNumber();
}

/**
 * Equity at Year N = Appreciated Value - Remaining Balance
 */
export function calculateEquityYearN(
  purchasePrice: number,
  appreciationRate: number,
  loanAmount: number,
  annualRate: number,
  termYears: number,
  yearN: number
): number {
  const appreciatedValue = new Decimal(purchasePrice)
    .mul(new Decimal(1).plus(new Decimal(appreciationRate).div(100)).pow(yearN));
  const remainingBalance = calculateRemainingBalance(loanAmount, annualRate, termYears, yearN);

  return appreciatedValue.minus(remainingBalance).toDecimalPlaces(2).toNumber();
}

/**
 * ARV Equity (fixer-upper) = ARV - (loan_amount + renovation_cost)
 */
export function calculateARVEquity(
  arv: number,
  loanAmount: number,
  renovationCost: number
): number {
  return new Decimal(arv).minus(new Decimal(loanAmount).plus(renovationCost)).toDecimalPlaces(2).toNumber();
}
```

### Pattern 7: PDF Generation Service

```typescript
// src/lib/services/pdf-service.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// For local development, use system Chrome
const LOCAL_CHROME_PATH = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome';

async function getBrowser() {
  if (process.env.VERCEL_ENV) {
    // Production/Preview: use @sparticuz/chromium
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    // Local development: use system Chrome
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: LOCAL_CHROME_PATH,
      headless: true,
    });
  }
}

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

### Anti-Patterns to Avoid

- **Using `getSession()` in middleware:** Use `getUser()` instead. `getSession()` reads the JWT without verifying it; `getUser()` calls Supabase to confirm the session is active.
- **Using service role client in route handlers serving user requests:** Use anon key + user JWT. Service role bypasses RLS.
- **Storing financial values as FLOAT in Postgres:** Use `NUMERIC(12,2)` for dollar amounts, `NUMERIC(5,2)` for percentages.
- **Using native `+ - * /` on dollar amounts in TypeScript:** Use `decimal.js` Decimal class for all monetary math.
- **Using `puppeteer` (full package) instead of `puppeteer-core`:** Full package bundles Chromium and exceeds Vercel's 250MB function limit.
- **Calling `cookies()` synchronously in Next.js 14.2:** In Next.js 14.2+, `cookies()` may need `await`. The server client creation should use `await cookies()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arbitrary-precision arithmetic | Custom BigInt wrapper | decimal.js | 5,500+ tests in decimal.js; handles rounding modes, financial precision |
| Cookie-based auth session | Custom JWT + cookie management | @supabase/ssr | Handles token refresh, cookie chunking (for large JWTs), PKCE flow |
| Serverless Chromium binary | Chromium download script | @sparticuz/chromium | Maintained, compressed to ~50MB, tested on Lambda/Vercel |
| Row-level security | Application-level WHERE clauses | Supabase RLS policies | DB-level enforcement cannot be bypassed by application bugs |
| Database migrations | Manual SQL scripts | Supabase CLI migrations | Versioned, repeatable, supports local + remote apply |
| Test coverage reporting | Custom line counting | @vitest/coverage-v8 | V8-based, fast, integrates with Vitest natively |

## Common Pitfalls

### Pitfall 1: RLS Policies Missing on New Tables
**What goes wrong:** A table is created without `ENABLE ROW LEVEL SECURITY` and policies. In single-user Phase 1 this is invisible. When more users are added, data leaks between tenants.
**Why it happens:** RLS is opt-in per table in Supabase. Creating a table does NOT enable RLS.
**How to avoid:** Every migration that creates a user-scoped table MUST include the RLS enable + 4 policies. Verify with the RLS audit query (see Validation Architecture).
**Warning signs:** Tables in `pg_tables` without corresponding entries in `pg_policies`.

### Pitfall 2: Floating Point Precision in Financial Calculations
**What goes wrong:** `0.1 + 0.2 = 0.30000000000000004`. Over 360 months of P&I, errors compound. Deal scores that threshold at 8.00% CoC flip incorrectly.
**Why it happens:** JavaScript has no native decimal type.
**How to avoid:** Use `new Decimal()` for every financial operation. Test against known amortization table values to the cent. Never use `toBeCloseTo()` in financial tests -- use exact equality.
**Warning signs:** Raw arithmetic operators on dollar amounts in the engine code.

### Pitfall 3: Middleware Not Refreshing Session
**What goes wrong:** RLS queries return empty results even though data exists. The user appears logged in on the client but server queries fail.
**Why it happens:** The JWT has expired but wasn't refreshed by middleware. Server-side Supabase client uses the stale JWT.
**How to avoid:** Middleware MUST call `getUser()` on every request. This triggers token refresh. Never skip this call.
**Warning signs:** Intermittent empty query results after the user has been idle for > 1 hour.

### Pitfall 4: Puppeteer PDF Fails on Vercel Preview
**What goes wrong:** PDF generation works locally but fails on Vercel with timeout or "Failed to launch chrome" errors.
**Why it happens:** Different Chromium binary, different environment constraints, cold starts.
**How to avoid:** Use `@sparticuz/chromium` with environment detection (`process.env.VERCEL_ENV`). Set `maxDuration: 60` on the PDF route. Add `serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium']` to next.config.
**Warning signs:** No Vercel preview test in the plan; PDF tested only locally.

### Pitfall 5: Admin Seed Script Fails on Subsequent Runs
**What goes wrong:** The seed script tries to create the admin user but fails because they already exist.
**Why it happens:** `auth.admin.createUser()` throws when email is already registered.
**How to avoid:** Check for "already been registered" in the error message and treat as success. Make the script idempotent.

## Code Examples

### Complete Database Migration

```sql
-- supabase/migrations/00001_initial_schema.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE plan_status AS ENUM ('active', 'trialing', 'past_due', 'canceled');
CREATE TYPE deal_status AS ENUM ('prospect', 'analyzed', 'offer_made', 'acquired', 'pass');

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  stripe_customer_id TEXT,
  plan plan_tier NOT NULL DEFAULT 'free',
  plan_status plan_status NOT NULL DEFAULT 'active',
  plan_limits JSONB DEFAULT '{}',
  deals_analyzed_this_month INTEGER NOT NULL DEFAULT 0,
  properties_tracked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- USER_SETTINGS
-- ============================================================
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Market targeting
  target_market TEXT NOT NULL DEFAULT 'DFW',
  target_submarkets TEXT[] NOT NULL DEFAULT '{}',
  property_types TEXT[] NOT NULL DEFAULT '{}',
  price_ceiling NUMERIC(12,2) NOT NULL DEFAULT 400000,
  down_payment_pct NUMERIC(5,2) NOT NULL DEFAULT 20,
  -- Underwriting assumptions
  property_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 1.8,
  mgmt_pct NUMERIC(5,2) NOT NULL DEFAULT 9,
  vacancy_pct NUMERIC(5,2) NOT NULL DEFAULT 8,
  maintenance_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  capex_pct NUMERIC(5,2) NOT NULL DEFAULT 5,
  closing_costs_pct NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  -- Goals and alerts
  acquisition_goal_count INTEGER NOT NULL DEFAULT 5,
  acquisition_goal_years INTEGER NOT NULL DEFAULT 5,
  alert_email TEXT,
  mortgage_rate_override NUMERIC(5,3),
  -- Scheduling
  finder_cron_interval INTERVAL DEFAULT '1 day',
  last_finder_run TIMESTAMPTZ,
  notification_preferences JSONB DEFAULT '{}',
  -- Branding (external PDFs)
  logo_url TEXT,
  accent_color TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  census_tract_fips TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  list_price NUMERIC(12,2),
  estimated_value NUMERIC(12,2),
  estimated_rent NUMERIC(10,2),
  source TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_properties" ON public.properties
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_properties" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_properties" ON public.properties
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status deal_status NOT NULL DEFAULT 'prospect',
  deal_score NUMERIC(5,1),
  verdict TEXT, -- GO / CAUTIOUS GO / NO
  is_fixer_upper BOOLEAN NOT NULL DEFAULT false,
  renovation_cost NUMERIC(12,2) DEFAULT 0,
  arv NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_deals" ON public.deals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_deals" ON public.deals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_deals" ON public.deals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_deals" ON public.deals
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PIPELINE_STAGES (stage transition history)
-- ============================================================
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_status deal_status,
  to_status deal_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_pipeline" ON public.pipeline_stages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_pipeline" ON public.pipeline_stages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  offer_price NUMERIC(12,2) NOT NULL,
  offer_date DATE NOT NULL,
  outcome TEXT, -- accepted / rejected / countered / pending
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_offers" ON public.offers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_offers" ON public.offers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_offers" ON public.offers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_offers" ON public.offers
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- COMPARABLES
-- ============================================================
CREATE TABLE public.comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  comp_address TEXT NOT NULL,
  comp_type TEXT NOT NULL, -- 'sale' or 'rental'
  price NUMERIC(12,2),
  rent NUMERIC(10,2),
  sqft INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  distance_miles NUMERIC(5,2),
  sold_date DATE,
  source TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comparables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_comparables" ON public.comparables
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_comparables" ON public.comparables
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_comparables" ON public.comparables
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_comparables" ON public.comparables
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ANALYSIS_RESULTS
-- ============================================================
CREATE TABLE public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL, -- 'market', 'underwriting', 'comparables', 'verdict'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'complete', 'error'
  result_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_analysis" ON public.analysis_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_analysis" ON public.analysis_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_analysis" ON public.analysis_results
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_analysis" ON public.analysis_results
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PDF_REPORTS
-- ============================================================
CREATE TABLE public.pdf_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- 'internal' or 'external'
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_reports" ON public.pdf_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_reports" ON public.pdf_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_reports" ON public.pdf_reports
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- API_CACHE (global -- no user_id)
-- ============================================================
CREATE TABLE public.api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  cache_key TEXT NOT NULL UNIQUE,
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_api_cache_key ON public.api_cache(cache_key);
CREATE INDEX idx_api_cache_expires ON public.api_cache(expires_at);

ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read cache (for UI display)
CREATE POLICY "authenticated_read_cache" ON public.api_cache
  FOR SELECT TO authenticated USING (true);
-- Only service role can write (inserts/updates happen server-side via DataService)

-- ============================================================
-- API_USAGE_LOG (global tracking, nullable user_id)
-- ============================================================
CREATE TABLE public.api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_provider ON public.api_usage_log(provider, called_at);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read usage log
CREATE POLICY "authenticated_read_usage" ON public.api_usage_log
  FOR SELECT TO authenticated USING (true);
-- Only service role can insert

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### RLS Audit Query

```sql
-- Run this to verify RLS is enabled on all expected tables
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COALESCE(array_agg(p.policyname ORDER BY p.policyname), '{}') AS policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

Expected output: every table should have `rls_enabled = true` and at least 1 policy.

### next.config.mjs for Phase 1

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
};

export default nextConfig;
```

### vercel.json for PDF Route

```json
{
  "functions": {
    "src/app/api/reports/generate/route.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

### PDF Route Handler

```typescript
// src/app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePDF } from '@/lib/services/pdf-service';

export const runtime = 'nodejs'; // NOT edge
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dealId, reportType } = await request.json();

  // Generate HTML for the report (hardcoded deal data for Phase 1 test harness)
  const html = reportType === 'internal'
    ? buildInternalReportHTML(/* hardcoded data */)
    : buildExternalReportHTML(/* hardcoded data */);

  const pdfBuffer = await generatePDF(html);

  // Upload to Supabase Storage using service role client
  const admin = createAdminClient();
  const storagePath = `${user.id}/${dealId}/${reportType}-${Date.now()}.pdf`;

  const { error: uploadError } = await admin.storage
    .from('reports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // Get signed URL (valid for 1 hour)
  const { data: { signedUrl } } = await admin.storage
    .from('reports')
    .createSignedUrl(storagePath, 3600);

  // Save record to pdf_reports table (service role bypasses RLS for insert)
  await admin.from('pdf_reports').insert({
    user_id: user.id,
    deal_id: dealId,
    report_type: reportType,
    storage_path: storagePath,
    file_size_bytes: pdfBuffer.length,
  });

  return NextResponse.json({ url: signedUrl, storagePath });
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (created in Plan 01-01) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNDER-01 | P&I matches amortization table | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "P&I"` | Wave 0 |
| UNDER-02 | NOI calculation | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "NOI"` | Wave 0 |
| UNDER-03 | Cap Rate | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "cap rate"` | Wave 0 |
| UNDER-04 | Cash-on-Cash | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "cash-on-cash"` | Wave 0 |
| UNDER-05 | DSCR | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "DSCR"` | Wave 0 |
| UNDER-06 | GRM | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "GRM"` | Wave 0 |
| UNDER-07 | Equity Year N | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "equity"` | Wave 0 |
| UNDER-08 | ARV Equity fixer-upper | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "ARV"` | Wave 0 |
| UNDER-09 | Deal Score composite | unit | `npx vitest run src/lib/engine/__tests__/deal-score.test.ts` | Wave 0 |
| UNDER-10 | All math uses decimal.js | static analysis | `grep -r "new Decimal" src/lib/engine/ --include="*.ts" -l` | Verify at review |
| UNDER-11 | Zero hardcoded values | static analysis | `grep -rn "= [0-9]" src/lib/engine/underwriting.ts` should show only Decimal config | Verify at review |
| UNDER-12 | Fixer-upper dual scenarios | unit | `npx vitest run src/lib/engine/__tests__/underwriting.test.ts -t "fixer"` | Wave 0 |
| AUTH-02 | Unauthenticated redirect | manual | Visit any route without session; verify redirect to /login | Manual |
| AUTH-03 | Session persists across refresh | manual | Log in, refresh browser, verify still authenticated | Manual |
| DB-07 | RLS on all user-scoped tables | SQL query | Run RLS audit query (see below) | Manual (SQL) |

### Specific Verification Commands

**1. Verify RLS is enabled on all tables:**

```sql
-- Must return rls_enabled = true for EVERY table in public schema
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- Expected result: EMPTY (zero rows). If any rows appear, RLS is missing.
```

**2. Verify all user-scoped tables have policies:**

```sql
-- Every user-scoped table must have >= 2 policies
SELECT t.tablename, COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN ('api_cache', 'api_usage_log') -- global tables
GROUP BY t.tablename
HAVING COUNT(p.policyname) < 2;
-- Expected result: EMPTY
```

**3. Verify decimal.js is used (not native floats) in engine:**

```bash
# Must find Decimal usage in every engine file
grep -c "new Decimal" src/lib/engine/underwriting.ts
# Expected: > 0 (many usages)

# Must NOT find raw arithmetic on financial values (excluding Decimal operations)
# Look for patterns like: amount * rate, price / months (without Decimal)
grep -Pn '(?<!Decimal\()(?:price|amount|rent|cost|loan|payment|noi|equity)\s*[\*\/\+\-]\s*' src/lib/engine/underwriting.ts
# Expected: 0 matches (or only in comments/type annotations)
```

**4. Verify Puppeteer works on Vercel preview:**

```bash
# After deploying to Vercel preview, test the PDF endpoint:
curl -X POST https://<preview-url>/api/reports/generate \
  -H "Cookie: <auth-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"dealId": "test", "reportType": "internal"}' \
  -o /dev/null -w "%{http_code}"
# Expected: 200

# Verify the returned URL downloads a valid PDF:
curl -L "<signed-url-from-response>" -o test.pdf
file test.pdf
# Expected: "test.pdf: PDF document, version 1.4"
```

**5. Verify underwriting engine coverage:**

```bash
npx vitest run --coverage --reporter=verbose
# Coverage output must show:
# src/lib/engine/underwriting.ts: 100% Stmts, 100% Branch, 100% Funcs, 100% Lines
# src/lib/engine/deal-score.ts: 100% Stmts, 100% Branch, 100% Funcs, 100% Lines
```

**6. Verify admin user can log in:**

```bash
# After seeding, attempt login via Supabase Auth REST API
curl -X POST "https://<supabase-url>/auth/v1/token?grant_type=password" \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"email": "<ADMIN_EMAIL>", "password": "<ADMIN_PASSWORD>"}'
# Expected: 200 with access_token in response
```

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (underwriting tests only until Plan 01-04)
- **Per wave merge:** `npx vitest run --coverage` (full suite with coverage thresholds)
- **Phase gate:** Full suite green + RLS audit query clean + PDF renders on Vercel preview

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- Vitest configuration (created in Plan 01-01)
- [ ] `src/lib/engine/__tests__/underwriting.test.ts` -- all financial formula tests (created in Plan 01-04, TDD)
- [ ] `src/lib/engine/__tests__/deal-score.test.ts` -- deal score composite tests (created in Plan 01-04, TDD)
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | v25.8.0 | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| npx | CLI tools | Yes | via npm | -- |
| Supabase CLI | Migrations, local dev | Yes | 2.84.5 | -- |
| Google Chrome (local) | Puppeteer local dev | Check at runtime | -- | Install Chrome or use `PUPPETEER_EXECUTABLE_PATH` env var |

**Missing dependencies with no fallback:** None -- all required tools are available.

**Missing dependencies with fallback:**
- Google Chrome for local Puppeteer development: if not installed at the expected path, set `PUPPETEER_EXECUTABLE_PATH` env var or use `npx puppeteer browsers install chrome`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Auth helpers are deprecated. Use SSR package exclusively. |
| `getSession()` in middleware | `getUser()` in middleware | 2024 | `getSession()` does not verify JWT. `getUser()` calls server to confirm session. |
| `getUser()` in middleware | `getClaims()` in middleware (optional) | Late 2025 | `getClaims()` validates JWT locally via JWKS, faster. But `getUser()` is safer for session invalidation checks. |
| `chrome-aws-lambda` | `@sparticuz/chromium` | 2022 | chrome-aws-lambda abandoned. @sparticuz/chromium is the maintained fork. |
| `@supabase/ssr@0.9.0` | `@supabase/ssr@0.10.0` | 2025 | Minor API updates. Core getAll/setAll pattern unchanged. |

## Open Questions

1. **`cookies()` sync vs async in Next.js 14.2.35**
   - What we know: Next.js 15 made `cookies()` async. Some Next.js 14.2.x patches started warning about sync usage.
   - What's unclear: Whether 14.2.35 requires `await cookies()` or tolerates sync.
   - Recommendation: Use `await cookies()` defensively. If it fails, remove the await. The code examples above use async.

2. **`@sparticuz/chromium@143` + `puppeteer-core@24.40.0` compatibility on Vercel**
   - What we know: Version 143 and puppeteer-core 24.x are the documented pair. Gist and Vercel KB confirm the pattern.
   - What's unclear: Whether the absolute latest patch (24.40.0) has any regressions.
   - Recommendation: Test on Vercel preview as the very first step of Plan 01-05. If it fails, pin to an earlier puppeteer-core@24 patch.

3. **Supabase Storage bucket configuration**
   - What we know: Need a `reports` bucket. Can be public or private.
   - What's unclear: Whether to create via migration, dashboard, or seed script.
   - Recommendation: Create via Supabase dashboard for now; document in Plan 01-05. Use private bucket with signed URLs.

## Sources

### Primary (HIGH confidence)
- npm registry (verified 2026-03-30) -- all version numbers confirmed
- [Supabase Auth admin.createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) -- seed script pattern
- [Supabase SSR Next.js setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- client types, middleware
- [Vercel Puppeteer deployment guide](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel) -- @sparticuz/chromium pattern
- [Chromium serverless gist](https://gist.github.com/kettanaito/56861aff96e6debc575d522dd03e5725) -- verified launch config
- [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) -- vitest.config.ts pattern
- Supabase CLI (locally verified: v2.84.5)

### Secondary (MEDIUM confidence)
- [Supabase getClaims vs getUser discussion](https://github.com/supabase/supabase/issues/39947) -- getClaims() is newer, recommended for performance
- [Supabase SSR creating-a-client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- getAll/setAll pattern

### Tertiary (LOW confidence)
- `cookies()` async behavior in Next.js 14.2.35 -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry 2026-03-30
- Architecture: HIGH -- patterns well-documented in official sources, confirmed by prior project research
- Pitfalls: HIGH -- RLS, float precision, and Puppeteer pitfalls are well-known and documented
- Vitest setup: MEDIUM-HIGH -- Next.js official docs confirm the pattern; exact config may need minor tweaks
- Puppeteer on Vercel: MEDIUM -- pattern confirmed by Vercel KB and community, but must be validated on actual deployment

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack, 30-day validity)
