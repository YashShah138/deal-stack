# Stack Research

**Domain:** Full-stack agentic real estate investment SaaS
**Researched:** 2026-03-30
**Confidence:** MEDIUM (versions verified via npm registry; architectural patterns from training data, not live docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 14.2.35 | Full-stack React framework (App Router) | Project constraint. Pin to 14.x -- do NOT upgrade to 15/16. 14.2.x is the most stable App Router release in the 14 line. Avoids breaking changes in 15 (async request APIs, new caching defaults). |
| TypeScript | ~5.5.x | Type safety | Use 5.5.x (ships with Next 14.2). Do NOT use 6.x -- Next.js 14 does not support it. |
| Tailwind CSS | 3.4.x | Utility-first CSS | Use 3.4.x. Do NOT use Tailwind 4.x (4.2.2 is latest) -- it has a completely new config system and postcss plugin that is incompatible with many Next.js 14 starter configs. Stick with v3 for stability. |
| Supabase JS | 2.100.1 | Database client + Auth | The isomorphic client. Always use alongside @supabase/ssr for Next.js App Router. |
| @supabase/ssr | 0.9.0 | Server-side auth for Next.js | Replaces the deprecated @supabase/auth-helpers-nextjs. This is the ONLY correct package for Next.js App Router + Supabase Auth in 2025+. |
| React | 18.x | UI library | Locked by Next.js 14. Do NOT use React 19 -- it requires Next.js 15+. |

### AI / Agent Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @anthropic-ai/sdk | 0.80.0 | Claude API client | Official TypeScript SDK. Supports streaming (`.stream()`), tool use (including `web_search`), and structured outputs. Version 0.36+ introduced the server-sent events streaming API. 0.80.0 is current. |

**Claude API usage pattern for agents:**

```typescript
// web_search is a server-side tool provided by Anthropic, not a client tool
// You declare it in the tools array and Claude calls it automatically
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [{ type: "web_search", name: "web_search" }],
  messages: [{ role: "user", content: prompt }],
});

// For streaming (agent analysis screen):
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  tools: [{ type: "web_search", name: "web_search" }],
  messages: [{ role: "user", content: prompt }],
});
```

**CRITICAL: web_search is a server-side Anthropic-hosted tool.** It is NOT a function you implement. You declare `{ type: "web_search" }` in the tools array and the API handles it. This means the Finder Agent can search for listings without you building a scraper -- Claude does it via the API. Verify the exact tool schema against official docs at build time (LOW confidence on exact field names as this is a newer feature).

### PDF Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| puppeteer-core | 24.40.0 | Browser automation for PDF | Use puppeteer-core (NOT puppeteer) -- puppeteer bundles Chromium which is too large for serverless. puppeteer-core connects to a provided Chromium binary. |
| @sparticuz/chromium | 143.0.4 | Serverless-compatible Chromium | The ONLY viable Chromium for Vercel/AWS Lambda. Compressed to ~50MB, fits within Lambda/Vercel size limits. This replaces the abandoned chrome-aws-lambda. |

**Vercel PDF generation constraints (CRITICAL):**

1. **Function size limit:** Vercel Pro allows 250MB uncompressed for serverless functions. @sparticuz/chromium is ~50MB compressed / ~170MB uncompressed. This FITS but is tight.
2. **Execution timeout:** Vercel Hobby = 10s, Pro = 60s, Enterprise = 900s. PDF generation typically takes 5-15s. You NEED Vercel Pro minimum.
3. **Memory:** Chromium needs at least 512MB RAM. Configure in `vercel.json`:

```json
{
  "functions": {
    "app/api/reports/generate/route.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

4. **Edge Runtime is NOT an option.** Puppeteer requires Node.js runtime. The PDF route handler MUST use `export const runtime = 'nodejs'`.
5. **Cold starts:** First invocation after idle will take 3-8s extra. Consider a warming strategy or accept it for Phase 0.

**Alternative considered: Playwright.** Playwright (1.58.2) is technically superior but has NO serverless-compatible Chromium equivalent. @sparticuz/chromium only works with puppeteer-core. If you ever need to move off Vercel to a container-based deployment, Playwright becomes viable. For Vercel serverless, Puppeteer + @sparticuz/chromium is the only path.

### Database & Auth

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @supabase/supabase-js | 2.100.1 | Postgres client + realtime | Isomorphic client. Use for both browser and server. |
| @supabase/ssr | 0.9.0 | Server-side auth cookie management | Handles cookie-based session for App Router server components, route handlers, and middleware. |

**Supabase Auth + RLS + Next.js App Router pattern (CRITICAL ARCHITECTURE):**

There are THREE Supabase client types you must create and use correctly:

```
1. Browser client   -- used in Client Components ('use client')
2. Server client    -- used in Server Components, Route Handlers, Server Actions
3. Middleware client -- used in middleware.ts to refresh sessions
```

**Pattern:**

```typescript
// lib/supabase/client.ts (browser)
import { createBrowserClient } from '@supabase/ssr';
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// lib/supabase/server.ts (server components + route handlers)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const createClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
};

// middleware.ts -- MUST refresh session on every request
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  // CRITICAL: This refreshes the session. Without it, RLS breaks.
  await supabase.auth.getUser();

  // Redirect unauthenticated users
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

**RLS gotchas:**

1. **ALWAYS call `getUser()` in middleware**, not `getSession()`. `getSession()` reads from the JWT without verifying it with Supabase. `getUser()` makes a server call to verify. For auth-gating, always use `getUser()`.
2. **The anon key is safe to expose client-side** -- RLS policies enforce access. The anon key only grants access through RLS policies, not admin access.
3. **Service role key is for server-only admin operations** (seeding, migrations, bypassing RLS). NEVER expose it to the client. Use it in API routes only.
4. **RLS policies use `auth.uid()`** -- this reads from the JWT. The middleware refresh ensures the JWT is current.
5. **Every user-scoped table needs this RLS pattern:**

```sql
-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "users_own_data" ON properties
  FOR ALL USING (user_id = auth.uid());
```

6. **Server Components are NOT authenticated by default.** You must create a server client and call `getUser()` in each server component that needs user context. The middleware handles the session refresh, but each component must retrieve the user independently.

### Email

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Resend | 6.9.4 | Transactional email API | Purpose-built for developer email. Free tier: 100 emails/day, 3000/month. More than enough for Phase 0 digest alerts. Simpler than Nodemailer (no SMTP config, no deliverability tuning). |
| @react-email/components | 1.0.10 | Email templates | Build email templates as React components. Pairs perfectly with Resend. Use for the digest alert email template. |

**Why NOT Nodemailer:** Nodemailer requires SMTP credentials, deliverability configuration (SPF/DKIM/DMARC), and connection management. Resend handles all of this. Nodemailer is the right choice when you need to use your own SMTP server or have high volume. For a SaaS sending < 100 emails/day, Resend is strictly better DX.

### UI Components & Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.7.0 | Icon library | All icons throughout the app. Tree-shakeable, consistent with Tailwind aesthetic. |
| clsx | 2.1.1 | Conditional class names | Every component with dynamic classes. |
| tailwind-merge | 3.5.0 | Merge Tailwind classes without conflicts | Combine with clsx as `cn()` utility. |
| class-variance-authority | 0.7.1 | Component variants | Button, Badge, Card variant definitions. |
| zod | 4.3.6 | Schema validation | ALL form validation, API input validation, env var validation. Use everywhere. |
| sonner | 2.0.7 | Toast notifications | All user feedback (success, error, loading). Better than react-hot-toast (built for Next.js App Router). |
| recharts | 3.8.1 | Charts | Dashboard metrics, portfolio equity curves, market trend visualizations. |
| @dnd-kit/core | 6.3.1 | Drag and drop | Kanban pipeline board (Prospect / Analyzed / Offer / Acquired / Pass). |
| @tanstack/react-table | 8.21.3 | Data tables | Comps tables, deal comparison, portfolio list views. |
| zustand | 5.0.12 | Client state management | Lightweight, no boilerplate. Use for UI state only (pipeline filters, modal state). All server state goes through Supabase. |

### Background Jobs / Cron

**Vercel Cron Jobs** (built-in, no extra library needed):

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/finder",
      "schedule": "0 8 * * *"
    }
  ]
}
```

```typescript
// app/api/cron/finder/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Run finder agent for all users with cron enabled
  // ...
  return Response.json({ success: true });
}
```

**Constraints:**
- Vercel Hobby: 1 cron job, daily minimum
- Vercel Pro: 40 cron jobs, 1-minute minimum interval
- Each cron invocation is a serverless function call with the same timeout limits (60s Pro)
- For long-running agent work that exceeds 60s: split into per-user chunks, use Supabase as a job queue (write jobs to a table, process one at a time per invocation)

**Why NOT external cron services (Inngest, Trigger.dev, QStash):** Adds infrastructure complexity for Phase 0 where you have one user and one cron job. Vercel Cron is free, built-in, and sufficient. Migrate to Inngest/Trigger.dev if you need retry logic, fan-out, or complex workflows in Phase 1.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Use eslint-config-next (ships with create-next-app). |
| Prettier | Formatting | Use prettier-plugin-tailwindcss for class sorting. |
| Vitest | Unit testing | Faster than Jest for Vite-compatible setups. Use for underwriting math tests. |
| Supabase CLI | Local dev DB | `supabase init` + `supabase start` gives you local Postgres + Auth + Studio. Essential for RLS testing. |
| dotenv | Env management | Next.js handles .env natively. Use .env.local for secrets. |

## Installation

```bash
# Core framework
npm install next@14.2.35 react@18.3.1 react-dom@18.3.1

# Supabase
npm install @supabase/supabase-js@2 @supabase/ssr@0

# AI
npm install @anthropic-ai/sdk@0

# PDF generation
npm install puppeteer-core@24 @sparticuz/chromium@143

# Email
npm install resend@6 @react-email/components@1

# UI utilities
npm install lucide-react clsx tailwind-merge class-variance-authority sonner zod zustand

# Data visualization & interaction
npm install recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tanstack/react-table

# Dev dependencies
npm install -D typescript@5.5 @types/react @types/node tailwindcss@3.4 postcss autoprefixer
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 14 | Next.js 15/16 | If starting fresh today with no constraints. 15 has async request APIs and improved caching. But project constraint says 14. |
| Tailwind 3.4 | Tailwind 4.x | If on Next.js 15+ and want the new CSS-first config. Not compatible with typical Next 14 setups without extra work. |
| Resend | Nodemailer | If you need SMTP relay, on-premise email, or already have a transactional email provider with SMTP. |
| Puppeteer + @sparticuz/chromium | Playwright | If deploying to containers (Docker/Fly.io/Railway). Playwright has better API but no serverless Chromium package. |
| Puppeteer + @sparticuz/chromium | Gotenberg | If you want a dedicated PDF microservice. Good for high-volume PDF generation but adds infrastructure. |
| Vercel Cron | Inngest / Trigger.dev | If you need complex workflows, retry logic, fan-out, or job queues. Overkill for Phase 0 single-user cron. |
| Zustand | Jotai / Redux Toolkit | If you need atomic state (Jotai) or very complex state with devtools (Redux). Zustand is the sweet spot for this project size. |
| @dnd-kit | react-beautiful-dnd | Never. react-beautiful-dnd is abandoned/unmaintained. @dnd-kit is the successor. |
| Vitest | Jest | If you need a very mature ecosystem. Vitest is faster and has near-identical API. No reason to use Jest for new projects. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @supabase/auth-helpers-nextjs | DEPRECATED. Replaced by @supabase/ssr. Will not receive updates. | @supabase/ssr |
| puppeteer (full package) | Bundles Chromium (~280MB). Will exceed Vercel function size limits. | puppeteer-core + @sparticuz/chromium |
| chrome-aws-lambda | ABANDONED. Last updated 2021. Does not support recent Chromium versions. | @sparticuz/chromium |
| react-beautiful-dnd | UNMAINTAINED by Atlassian. No React 18 support. | @dnd-kit/core |
| Tailwind CSS 4.x | Breaking config changes. PostCSS plugin renamed. Not battle-tested with Next.js 14. | tailwindcss@3.4 |
| React 19 | Requires Next.js 15+. Incompatible with Next.js 14. | react@18.3.1 |
| next-auth / Auth.js | Adds complexity when Supabase Auth already provides auth + RLS integration. Two auth systems = confusion. | @supabase/ssr (Supabase Auth) |
| Prisma | Adds ORM layer on top of Supabase's PostgREST API. Conflicts with RLS (Prisma uses direct connections, bypassing RLS unless carefully configured). | @supabase/supabase-js (PostgREST client) |
| Drizzle ORM | Same issue as Prisma -- direct DB connections bypass RLS. Only viable if you use Supabase's connection pooler with RLS-aware roles, which is complex. | @supabase/supabase-js |
| SWR / React Query | Server Components fetch data directly. Client-side fetching libraries add complexity with no benefit when your data comes from Supabase client. | Direct Supabase queries in server components + zustand for UI state |
| getServerSideProps / getStaticProps | These are Pages Router APIs. Do NOT use in App Router. | Server Components + Route Handlers |

## Stack Patterns by Variant

**For Server Components (data fetching):**
- Create server Supabase client, call `getUser()`, query data directly
- No loading states needed -- data is fetched before render
- Use for: Dashboard, Deal Detail, Pipeline initial load, Portfolio

**For Client Components (interactive UI):**
- Create browser Supabase client for real-time subscriptions or client-side mutations
- Use for: Kanban drag-drop, Settings form, Analysis streaming view

**For Route Handlers (API routes):**
- Create server Supabase client from cookies
- Use for: PDF generation endpoint, Cron handler, Email trigger
- Service role client ONLY for admin operations (user seeding, cache table writes)

**For Streaming AI responses:**
- Route Handler streams response using ReadableStream
- Client Component uses EventSource or fetch with reader
- Pattern:

```typescript
// app/api/analyze/route.ts
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const stream = anthropic.messages.stream({...});
  return new Response(stream.toReadableStream());
}
```

**For the Finder Agent cron job (exceeding 60s timeout):**
- Design for chunked execution: one user per invocation
- Store job state in Supabase: `finder_jobs` table with status (pending/running/complete)
- Cron handler picks next pending job, runs one user's search, marks complete
- If you have 10 users in Phase 1, the cron runs 10 times (one per minute) to process all

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@14.2.35 | react@18.3.x, typescript@5.5.x | Do NOT pair with React 19 or TS 6 |
| @supabase/ssr@0.9.0 | @supabase/supabase-js@2.x | Must use together. ssr depends on supabase-js. |
| puppeteer-core@24 | @sparticuz/chromium@143 | These versions are tested together. Do not mix puppeteer-core@24 with older @sparticuz/chromium. |
| tailwindcss@3.4 | postcss@8, autoprefixer@10 | Standard PostCSS toolchain. |
| @anthropic-ai/sdk@0.80.0 | Node 18+ | Requires fetch API (native in Node 18+). Vercel serverless uses Node 20 by default. |
| zod@4.3.6 | Note: Zod 4 is a major version change from Zod 3 | If you encounter compatibility issues with form libraries, pin to zod@3.23.x instead. LOW confidence on Zod 4 ecosystem compatibility -- it was released recently. |

## Vercel-Specific Constraints Summary

| Constraint | Hobby | Pro | Impact |
|-----------|-------|-----|--------|
| Function timeout | 10s | 60s | PDF generation needs Pro. Agent analysis needs Pro. |
| Function size | 250MB | 250MB | @sparticuz/chromium fits but is ~170MB uncompressed. No room for bloat. |
| Cron jobs | 1 daily | 40, 1-min interval | Hobby insufficient for scheduled finder + digest. Need Pro. |
| Edge Runtime | Subset of Node APIs | Subset of Node APIs | Cannot run Puppeteer, Supabase server client, or Anthropic SDK on Edge. Use `runtime = 'nodejs'` for all API routes. |
| Middleware | Edge Runtime only | Edge Runtime only | Middleware runs on Edge. Keep it thin -- only session refresh + redirect logic. No heavy imports. |
| Environment variables | Via dashboard | Via dashboard | CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY must be in Vercel env vars, NOT in .env committed to git. |

**Verdict: Vercel Pro is REQUIRED for this project.** Hobby plan is insufficient due to function timeouts and cron limits.

## Sources

- npm registry (verified 2026-03-30) -- all version numbers confirmed via `npm view`
- Supabase Auth + Next.js App Router pattern -- based on @supabase/ssr package documentation and established community patterns (MEDIUM confidence -- could not verify live docs)
- @sparticuz/chromium Vercel compatibility -- based on package purpose and established serverless Chromium patterns (MEDIUM confidence)
- Anthropic SDK web_search tool -- based on training data knowledge of the Claude API tool use feature (LOW confidence on exact web_search schema -- verify against docs at implementation time)
- Vercel cron and function limits -- based on established Vercel documentation (MEDIUM confidence -- limits may have changed)
- Zod 4.x compatibility -- LOW confidence. Zod 4 was a recent major release. If ecosystem issues arise, fall back to zod@3.23.x.

---
*Stack research for: DealStack - Agentic Real Estate Investment SaaS*
*Researched: 2026-03-30*
