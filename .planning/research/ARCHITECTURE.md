# Architecture Research

**Domain:** Agentic Real Estate Analysis SaaS (Next.js App Router + Supabase + Anthropic Claude)
**Researched:** 2026-03-30
**Confidence:** MEDIUM-HIGH (Vercel constraints verified from official docs; Supabase RLS and Claude streaming patterns based on training data + partial doc verification)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React Client)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Dashboard │ │Discovery │ │Pipeline  │ │Analysis  │ │Deal Detail   │  │
│  │          │ │          │ │(Kanban)  │ │(Stream)  │ │/ Compare /   │  │
│  │          │ │          │ │          │ │          │ │Portfolio/etc │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
│       │            │            │            │               │          │
│       │      useEventSource / ReadableStream consumer        │          │
└───────┴────────────┴────────────┴────────────┴───────────────┴──────────┘
        │                                      │
        ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP ROUTER (Vercel)                          │
│                                                                         │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐    │
│  │   Server Actions     │    │        Route Handlers (API)          │    │
│  │   (mutations only)   │    │                                      │    │
│  │  - updateSettings    │    │  POST /api/analyze     (streaming)   │    │
│  │  - updateDealStage   │    │  POST /api/finder      (streaming)   │    │
│  │  - approveListing    │    │  POST /api/pdf/generate              │    │
│  │  - deleteDeal        │    │  GET  /api/cron/finder               │    │
│  └──────────┬──────────┘    └──────────────┬───────────────────────┘    │
│             │                              │                            │
│             ▼                              ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    SERVICE LAYER                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │   │
│  │  │AgentOrchest. │  │DataService   │  │UnderwritingEngine      │  │   │
│  │  │(pipeline)    │  │(cache-first) │  │(pure math, no I/O)     │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘  │   │
│  │         │                 │                                       │   │
│  │         ▼                 ▼                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                               │   │
│  │  │Claude API    │  │External APIs │                               │   │
│  │  │(streaming)   │  │(Rentcast,    │                               │   │
│  │  │+ web_search  │  │ Census, etc) │                               │   │
│  │  └──────────────┘  └──────────────┘                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Postgres     │  │  Auth         │  │  Storage      │                   │
│  │  (RLS on all  │  │  (JWT →       │  │  (PDFs)       │                   │
│  │   user tables)│  │   auth.uid()) │  │               │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Server Actions | Simple CRUD mutations that don't stream | `app/actions/*.ts` — form submissions, stage changes, settings updates |
| Route Handlers | Streaming agent responses + cron endpoints + PDF generation | `app/api/*/route.ts` — POST for agents, GET for cron |
| AgentOrchestrator | Sequences the 5-agent pipeline, emits progress events | `lib/agents/orchestrator.ts` — runs agents in order, yields SSE events |
| Individual Agents | Single-responsibility Claude API calls with specific system prompts | `lib/agents/{finder,market,underwriting,comparables,verdict}.ts` |
| DataService | Cache-first abstraction over all external APIs | `lib/services/data-service.ts` — checks api_cache before calling provider |
| UnderwritingEngine | Pure math: P&I, NOI, cap rate, CoC, DSCR, GRM, deal score | `lib/engine/underwriting.ts` — zero I/O, 100% unit testable |
| Supabase Client | Server-side DB access with RLS | `lib/supabase/server.ts` and `lib/supabase/client.ts` |

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Authenticated shell (sidebar, nav)
│   │   ├── page.tsx                # Dashboard
│   │   ├── discovery/page.tsx      # Finder results
│   │   ├── pipeline/page.tsx       # Kanban board
│   │   ├── analyze/[id]/page.tsx   # Streaming analysis screen
│   │   ├── deals/[id]/page.tsx     # Deal detail
│   │   ├── compare/page.tsx        # Side-by-side compare
│   │   ├── portfolio/page.tsx      # Acquired properties
│   │   ├── settings/page.tsx       # User investment profile
│   │   └── admin/page.tsx          # Admin panel (Phase 0)
│   ├── api/
│   │   ├── analyze/route.ts        # POST — full pipeline, streaming
│   │   ├── finder/route.ts         # POST — manual finder trigger, streaming
│   │   ├── pdf/route.ts            # POST — generate PDF
│   │   └── cron/
│   │       └── finder/route.ts     # GET — cron-triggered finder
│   ├── actions/
│   │   ├── deals.ts                # Server Actions for deal mutations
│   │   ├── settings.ts             # Server Actions for user settings
│   │   └── pipeline.ts             # Server Actions for stage transitions
│   └── layout.tsx                  # Root layout
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts         # Sequences agents, emits SSE
│   │   ├── base-agent.ts           # Shared agent interface + Claude call pattern
│   │   ├── finder.ts               # Finder Agent
│   │   ├── market-analysis.ts      # Market Analysis Agent
│   │   ├── underwriting.ts         # Underwriting Agent (calls engine)
│   │   ├── comparables.ts          # Comparables Agent
│   │   └── verdict.ts              # Verdict Agent
│   ├── engine/
│   │   ├── underwriting.ts         # Pure math functions
│   │   ├── deal-score.ts           # Weighted composite scoring
│   │   └── __tests__/              # Unit tests (TDD — build before UI)
│   ├── services/
│   │   ├── data-service.ts         # Cache-first abstraction
│   │   ├── providers/
│   │   │   ├── rentcast.ts         # Rentcast API provider
│   │   │   ├── census.ts           # Census ACS + Geocoder provider
│   │   │   └── walkscore.ts        # Walk Score provider
│   │   ├── pdf-service.ts          # PDF generation logic
│   │   └── email-service.ts        # Resend/Nodemailer
│   ├── supabase/
│   │   ├── server.ts               # createServerClient (cookies-based)
│   │   ├── client.ts               # createBrowserClient
│   │   ├── admin.ts                # Service role client (cron/background)
│   │   └── middleware.ts           # Auth middleware (refreshes session)
│   ├── types/
│   │   ├── database.ts             # Generated from Supabase (npx supabase gen types)
│   │   ├── agents.ts               # Agent input/output types
│   │   └── api.ts                  # External API response types
│   └── utils/
│       ├── streaming.ts            # SSE helpers
│       └── cache.ts                # Cache key generation
├── components/
│   ├── ui/                         # Shared UI primitives
│   ├── analysis/
│   │   ├── streaming-display.tsx   # Live agent output consumer
│   │   └── agent-progress.tsx      # Pipeline step indicator
│   ├── pipeline/
│   │   └── kanban-board.tsx
│   └── deals/
│       ├── deal-card.tsx
│       └── deal-compare.tsx
├── hooks/
│   ├── use-agent-stream.ts         # Custom hook for consuming SSE
│   └── use-supabase.ts
└── middleware.ts                    # Next.js middleware (auth guard)
```

### Structure Rationale

- **`app/api/` for streaming endpoints:** Route Handlers are the only way to return a `ReadableStream` response from Next.js App Router. Server Actions cannot stream.
- **`app/actions/` for mutations:** Server Actions are ideal for simple create/update/delete operations that return once. They get automatic form integration and optimistic UI support.
- **`lib/agents/` separated from `app/api/`:** Agent logic is decoupled from HTTP transport. The orchestrator can be called from a Route Handler (interactive analysis) or from the cron endpoint (scheduled finder). Same code, different triggers.
- **`lib/engine/` is pure:** No database calls, no API calls, no side effects. Just math in, numbers out. This is the TDD core.
- **`lib/services/data-service.ts` as single entry point:** Every external API call goes through DataService. No component or agent ever calls Rentcast/Census/Walk Score directly.

## Architectural Patterns

### Pattern 1: Route Handlers for Streaming Agent Output

**What:** Use Next.js Route Handlers (`app/api/*/route.ts`) with `ReadableStream` to stream agent progress and output to the frontend in real-time.

**When to use:** Any endpoint where the client needs to see progressive output (analysis pipeline, finder results).

**Trade-offs:**
- PRO: Native browser support via `fetch()` + `ReadableStream`, no WebSocket infrastructure needed
- PRO: Works perfectly on Vercel serverless (streaming is supported on Node.js runtime)
- CON: Unidirectional (server-to-client only). Client cannot send mid-stream messages.
- CON: If the connection drops, the client must restart from scratch (no resume).

**Example:**

```typescript
// app/api/analyze/route.ts
import { createServerClient } from '@/lib/supabase/server';
import { AgentOrchestrator } from '@/lib/agents/orchestrator';

export const maxDuration = 300; // 5 minutes — agents take time

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { propertyId } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const orchestrator = new AgentOrchestrator(supabase, user.id);
        for await (const event of orchestrator.analyze(propertyId)) {
          emit(event.type, event.payload);
        }
        emit('complete', { success: true });
      } catch (error) {
        emit('error', { message: (error as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

```typescript
// hooks/use-agent-stream.ts (client-side consumer)
'use client';
import { useState, useCallback } from 'react';

type AgentEvent = {
  type: 'agent_start' | 'agent_chunk' | 'agent_complete' | 'error' | 'complete';
  payload: Record<string, unknown>;
};

export function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startAnalysis = useCallback(async (propertyId: string) => {
    setIsStreaming(true);
    setEvents([]);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event: (.+)/);
        const dataMatch = block.match(/data: (.+)/);
        if (eventMatch && dataMatch) {
          const event: AgentEvent = {
            type: eventMatch[1] as AgentEvent['type'],
            payload: JSON.parse(dataMatch[1]),
          };
          setEvents(prev => [...prev, event]);
        }
      }
    }

    setIsStreaming(false);
  }, []);

  return { events, isStreaming, startAnalysis };
}
```

### Pattern 2: AsyncGenerator Agent Orchestrator

**What:** The orchestrator uses an `async function*` (async generator) to yield events as agents complete. This decouples the pipeline logic from the transport layer (SSE, WebSocket, or even batch mode for cron).

**When to use:** Always. This is the core pipeline pattern.

**Trade-offs:**
- PRO: Same pipeline code works for interactive (streaming) and batch (cron) execution
- PRO: Each agent yields structured events — the caller decides how to transport them
- PRO: Natural error boundaries — try/catch around each agent step

**Example:**

```typescript
// lib/agents/orchestrator.ts
export class AgentOrchestrator {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async *analyze(propertyId: string): AsyncGenerator<AgentEvent> {
    const settings = await this.loadUserSettings();
    const property = await this.loadProperty(propertyId);

    // Step 1: Market Analysis
    yield { type: 'agent_start', payload: { agent: 'market_analysis' } };
    const marketResult = await this.runMarketAnalysis(property, settings);
    yield { type: 'agent_complete', payload: { agent: 'market_analysis', result: marketResult } };

    // Step 2: Underwriting
    yield { type: 'agent_start', payload: { agent: 'underwriting' } };
    const underwritingResult = await this.runUnderwriting(property, settings);
    yield { type: 'agent_complete', payload: { agent: 'underwriting', result: underwritingResult } };

    // Step 3: Comparables
    yield { type: 'agent_start', payload: { agent: 'comparables' } };
    const compsResult = await this.runComparables(property, underwritingResult);
    yield { type: 'agent_complete', payload: { agent: 'comparables', result: compsResult } };

    // Step 4: Verdict (depends on all previous)
    yield { type: 'agent_start', payload: { agent: 'verdict' } };
    const verdictResult = await this.runVerdict(property, {
      market: marketResult,
      underwriting: underwritingResult,
      comparables: compsResult,
      settings,
    });
    yield { type: 'agent_complete', payload: { agent: 'verdict', result: verdictResult } };

    // Persist final analysis
    await this.saveAnalysis(propertyId, {
      market: marketResult,
      underwriting: underwritingResult,
      comparables: compsResult,
      verdict: verdictResult,
    });
  }
}
```

### Pattern 3: Cache-First DataService with Provider Abstraction

**What:** Every external API call routes through DataService. It checks `api_cache` first (keyed by provider + endpoint + params hash), returns cached data if fresh, otherwise calls the provider and caches the result. A usage log tracks calls against limits.

**When to use:** Every external API call without exception. This is non-negotiable with Rentcast's 50-call/month limit.

**Trade-offs:**
- PRO: Prevents accidental API exhaustion
- PRO: Providers are swappable (if Rentcast alternatives emerge)
- PRO: Stale cache can serve as fallback if provider is down
- CON: Cache invalidation complexity (different TTLs per provider)

**Example:**

```typescript
// lib/services/data-service.ts
interface CacheConfig {
  provider: string;
  endpoint: string;
  params: Record<string, unknown>;
  ttlDays: number;
}

export class DataService {
  constructor(private supabase: SupabaseClient) {}

  private async getCached<T>(config: CacheConfig): Promise<T | null> {
    const cacheKey = this.buildCacheKey(config);
    const { data } = await this.supabase
      .from('api_cache')
      .select('response_data, cached_at')
      .eq('cache_key', cacheKey)
      .single();

    if (!data) return null;

    const age = Date.now() - new Date(data.cached_at).getTime();
    const maxAge = config.ttlDays * 24 * 60 * 60 * 1000;
    if (age > maxAge) return null; // Expired

    return data.response_data as T;
  }

  private async cacheAndLog<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = await this.getCached<T>(config);
    if (cached) return cached;

    // Check rate limit before calling
    if (config.provider === 'rentcast') {
      const withinLimit = await this.checkRentcastLimit();
      if (!withinLimit) throw new Error('Rentcast monthly limit reached (50 calls)');
    }

    // Call provider
    const result = await fetcher();

    // Cache result
    const cacheKey = this.buildCacheKey(config);
    await this.supabase.from('api_cache').upsert({
      cache_key: cacheKey,
      provider: config.provider,
      endpoint: config.endpoint,
      params: config.params,
      response_data: result,
      cached_at: new Date().toISOString(),
    });

    // Log usage
    await this.supabase.from('api_usage_log').insert({
      provider: config.provider,
      endpoint: config.endpoint,
      called_at: new Date().toISOString(),
    });

    return result;
  }

  // Public API — each method delegates to a provider via cacheAndLog
  async getPropertyDetails(address: string) {
    return this.cacheAndLog(
      { provider: 'rentcast', endpoint: 'property', params: { address }, ttlDays: 30 },
      () => this.rentcastProvider.getProperty(address)
    );
  }

  async getRentEstimate(address: string) {
    return this.cacheAndLog(
      { provider: 'rentcast', endpoint: 'rent-estimate', params: { address }, ttlDays: 14 },
      () => this.rentcastProvider.getRentEstimate(address)
    );
  }

  async getCensusData(fips: string) {
    return this.cacheAndLog(
      { provider: 'census', endpoint: 'acs', params: { fips }, ttlDays: 90 },
      () => this.censusProvider.getACSData(fips)
    );
  }

  async geocodeAddress(address: string) {
    return this.cacheAndLog(
      { provider: 'census_geocoder', endpoint: 'geocode', params: { address }, ttlDays: 36500 }, // "permanent"
      () => this.censusProvider.geocode(address)
    );
  }

  async getWalkScore(lat: number, lon: number, address: string) {
    return this.cacheAndLog(
      { provider: 'walkscore', endpoint: 'score', params: { lat, lon }, ttlDays: 36500 }, // "permanent"
      () => this.walkscoreProvider.getScore(lat, lon, address)
    );
  }

  private buildCacheKey(config: CacheConfig): string {
    const paramStr = JSON.stringify(config.params, Object.keys(config.params).sort());
    return `${config.provider}:${config.endpoint}:${paramStr}`;
  }
}
```

### Pattern 4: Supabase RLS for Multi-Tenant Data

**What:** Every user-scoped table has a `user_id UUID REFERENCES auth.users(id)` column and RLS policies that enforce `auth.uid() = user_id`. The Supabase client created from the user's JWT automatically scopes all queries.

**When to use:** Every user-data table. No exceptions.

**Trade-offs:**
- PRO: Security enforced at database level — even buggy application code cannot leak data across users
- PRO: `auth.uid()` is extracted from the JWT, no application logic needed
- CON: Service-role client bypasses RLS (needed for cron jobs, but must be used carefully)
- CON: RLS adds ~1-2ms overhead per query (negligible for this use case)

**Policy pattern for all user-scoped tables:**

```sql
-- Example: deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect',
  -- ... other columns
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deals
CREATE POLICY "Users can view own deals"
  ON deals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert deals for themselves
CREATE POLICY "Users can insert own deals"
  ON deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own deals
CREATE POLICY "Users can update own deals"
  ON deals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own deals
CREATE POLICY "Users can delete own deals"
  ON deals FOR DELETE
  USING (auth.uid() = user_id);
```

**Tables that need this pattern:** `deals`, `analyses`, `user_settings`, `portfolio_properties`, `finder_results`, `pipeline_stages` (any table with user-owned data).

**Tables that do NOT need user-scoped RLS:** `api_cache` (global, shared across users), `api_usage_log` (global rate limit tracking). These should have restrictive policies: service-role only for writes, optionally readable by authenticated users.

```sql
-- api_cache: no user_id — global cache
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can write (from DataService on server)
-- Authenticated users can read (for displaying cached status, optional)
CREATE POLICY "Authenticated users can read cache"
  ON api_cache FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated role
-- Only service_role (used server-side) can write
```

### Pattern 5: Cron-Triggered Finder via Single Vercel Cron + User Iterator

**What:** A single Vercel Cron Job (configured in `vercel.json`) fires at the highest common frequency (e.g., daily). The cron endpoint queries all users whose cron interval matches, then runs the Finder Agent for each eligible user.

**When to use:** Always. Vercel does not support dynamic per-user cron schedules. Use one cron job that fans out internally.

**Trade-offs:**
- PRO: Works within Vercel's 100 cron jobs limit (uses only 1)
- PRO: Per-user scheduling is stored in the database, fully dynamic
- CON: All user finder runs are serialized within one function invocation (or parallelized with Promise.all, but bounded by maxDuration)
- CON: On Hobby plan, cron can only run once/day with up to 59-minute timing drift

**Example:**

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
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

export async function GET(request: Request) {
  // Verify cron secret (prevent external triggering)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient(); // Bypasses RLS

  // Find users whose cron is due
  const { data: users } = await supabase
    .from('user_settings')
    .select('user_id, target_markets, price_ceiling, cron_interval, last_finder_run')
    .not('cron_interval', 'is', null);

  const dueUsers = users?.filter(u => isFinderDue(u)) ?? [];

  // Run finder for each due user (sequentially to stay within limits)
  for (const user of dueUsers) {
    try {
      const orchestrator = new AgentOrchestrator(supabase, user.user_id);
      // Consume generator without streaming (batch mode)
      for await (const _event of orchestrator.runFinder(user)) {
        // Events are discarded in cron mode — results saved to DB
      }
    } catch (error) {
      console.error(`Finder failed for user ${user.user_id}:`, error);
      // Continue to next user — don't let one failure block all
    }
  }

  return Response.json({ processed: dueUsers.length });
}
```

**Important Vercel Cron Constraints (verified from official docs):**
- Hobby plan: once/day minimum, +/- 59min timing precision
- Pro plan: once/minute minimum, per-minute precision
- Max 100 cron jobs per project (all plans)
- Cron triggers are HTTP GET requests to the production deployment
- Always verify `CRON_SECRET` header to prevent unauthorized access
- Function duration limits apply (Hobby: 300s, Pro: up to 800s)

## Data Flow

### Analysis Pipeline Flow (Primary User Flow)

```
User clicks "Analyze" on a property
    │
    ▼
Browser: POST /api/analyze { propertyId }
    │
    ▼
Route Handler: Auth check → create AgentOrchestrator
    │
    ▼
AgentOrchestrator.analyze(propertyId) — async generator
    │
    ├──→ [1] Market Analysis Agent
    │       ├── DataService.geocodeAddress() → Census Geocoder (cached permanently)
    │       ├── DataService.getCensusData() → Census ACS (cached 90d)
    │       ├── DataService.getWalkScore() → Walk Score API (cached permanently)
    │       ├── Claude API call (system prompt + data + web_search tool)
    │       └── yield { agent_complete, market_score, narrative }
    │
    ├──→ [2] Underwriting Agent
    │       ├── DataService.getPropertyDetails() → Rentcast (cached 30d)
    │       ├── DataService.getRentEstimate() → Rentcast (cached 14d)
    │       ├── UnderwritingEngine.calculate(property, rent, userSettings)
    │       │    └── Pure math: P&I, NOI, cap rate, CoC, DSCR, GRM, equity
    │       ├── Claude API call (proforma data + web_search for renovation ARV)
    │       └── yield { agent_complete, proforma, narrative }
    │
    ├──→ [3] Comparables Agent
    │       ├── Reuses Rentcast comps from step [2] (already cached)
    │       ├── Claude API call (comps data + web_search supplemental)
    │       └── yield { agent_complete, comps_analysis }
    │
    ├──→ [4] Verdict Agent
    │       ├── Receives results from [1], [2], [3]
    │       ├── DealScore = weighted composite (market, underwriting, comps)
    │       ├── Claude API call (all data → GO/CAUTIOUS GO/NO + reasoning)
    │       └── yield { agent_complete, deal_score, verdict, reasoning }
    │
    └──→ Save full analysis to DB (analyses table)
    │
    ▼
SSE stream closes → Client displays final results
```

**Key observations:**
- Agents [1] and [2] could theoretically run in parallel (no data dependency between them). However, serializing them is simpler and avoids doubling Claude API concurrency costs. Optimize later if needed.
- Agent [3] depends on [2] (reuses Rentcast comps data).
- Agent [4] depends on all previous agents.
- Each agent's Claude call may take 10-30 seconds. Total pipeline: 60-120 seconds typical. Well within the 300s Vercel limit.

### State Management

```
Server (source of truth)
    │
    ├── Supabase Postgres: deals, analyses, user_settings, pipeline state
    │
    ▼
Client (derived state)
    │
    ├── React Server Components: initial page data (deals list, pipeline, portfolio)
    ├── useAgentStream hook: transient streaming state (analysis in progress)
    └── React Query or SWR: client-side cache for data that updates (deal stage changes)
```

**No global client state store needed.** React Server Components handle initial loads, Server Actions handle mutations with `revalidatePath()`, and the streaming hook handles the one complex real-time flow.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user (Phase 0) | Everything as-is. Single cron job. No concurrency concerns. |
| 10-50 users (Phase 1) | Cron finder needs sequential processing within 300s. At ~60s per user, max ~5 users per cron run. May need to split into batches or use Vercel Pro (800s limit). |
| 100+ users | Cron approach breaks down. Need background job queue (Inngest, Trigger.dev, or QStash) to fan out finder runs. DataService cache becomes a major asset (shared cache across users analyzing same market). |

### Scaling Priorities

1. **First bottleneck: Cron function duration.** At ~10 active users with daily finders, a single 300s function may not complete all runs. **Fix:** Move to Inngest or QStash for fan-out background jobs. Each user's finder becomes its own invocation.
2. **Second bottleneck: Rentcast API limits.** 50 calls/month is shared across ALL users. With 10+ active users, this runs out fast. **Fix:** Aggressive caching, and the DataService architecture already handles this. May need to upgrade Rentcast plan or find supplemental data sources.

## PDF Generation on Vercel

### The Problem

Puppeteer bundles Chromium, which is ~130-280MB. Vercel's function bundle limit is 250MB (uncompressed). This is tight but feasible using `@sparticuz/chromium`, a stripped-down Chromium build designed for AWS Lambda / Vercel serverless.

### Recommended Approach

Use `puppeteer-core` + `@sparticuz/chromium`:

```typescript
// lib/services/pdf-service.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  });

  await browser.close();
  return Buffer.from(pdf);
}
```

**Vercel-specific constraints:**
- `@sparticuz/chromium` compresses to ~45-50MB, well within the 250MB limit
- Cold starts for Chromium: 3-8 seconds. Warm invocations: 1-2 seconds
- Memory: set function memory to at least 1GB (Hobby default is 2GB, sufficient)
- `/tmp` scratch space: 500MB available, Chromium uses this for temporary files
- `maxDuration`: set to at least 30 seconds for PDF generation
- **Confidence: MEDIUM** — `@sparticuz/chromium` compatibility with latest Puppeteer versions and Vercel's current runtime should be validated during implementation

### Alternative: External PDF Service

If Puppeteer proves too heavy or unreliable on Vercel, fall back to an external service:
- **Gotenberg** (self-hosted, Docker-based) — full Chromium, no size limits
- **Browserless.io** (managed) — connect Puppeteer to a remote browser
- **html-pdf-node** or **jsPDF** — no Chromium dependency but limited CSS fidelity (likely insufficient for "professional investment memo" requirement)

**Recommendation:** Start with `@sparticuz/chromium` on Vercel. If cold starts or reliability are unacceptable, move to Browserless.io (cheapest managed option with the same Puppeteer API).

## Anti-Patterns

### Anti-Pattern 1: Server Actions for Streaming

**What people do:** Try to use Server Actions to stream agent output because they seem simpler than Route Handlers.
**Why it's wrong:** Server Actions return a single response. They cannot stream. The client would block for 60-120 seconds with no progress indication.
**Do this instead:** Use Route Handlers with `ReadableStream` + SSE format. Use Server Actions only for simple mutations (save settings, move deal stage).

### Anti-Pattern 2: Direct API Calls from Agents

**What people do:** Have each agent call Rentcast/Census/Walk Score directly.
**Why it's wrong:** No caching, no rate limit enforcement, no usage tracking. You will burn through Rentcast's 50 calls in a day.
**Do this instead:** All external API calls go through DataService. Agents receive data, they don't fetch it.

### Anti-Pattern 3: Per-User Cron Jobs in vercel.json

**What people do:** Try to create dynamic cron entries for each user.
**Why it's wrong:** `vercel.json` cron is static, defined at deploy time. You cannot add/remove crons at runtime.
**Do this instead:** Single cron job that fans out to eligible users. User schedules stored in `user_settings` table.

### Anti-Pattern 4: Using Supabase Client-Side for Writes in Analysis Flow

**What people do:** Have the frontend write analysis results directly to Supabase after receiving them from the stream.
**Why it's wrong:** The server already has the complete results. Writing from the client creates race conditions, duplicates, and requires the client to stay connected. Also bypasses any server-side validation.
**Do this instead:** The server (AgentOrchestrator) saves analysis results to the database as the final step. The client only reads/displays.

### Anti-Pattern 5: Putting UnderwritingEngine Logic in the Agent

**What people do:** Mix financial calculations into the Claude API call, relying on the LLM to compute P&I, NOI, cap rate, etc.
**Why it's wrong:** LLMs make arithmetic errors. Financial calculations must be deterministic and testable.
**Do this instead:** UnderwritingEngine is pure TypeScript math. The Underwriting Agent calls the engine, then passes the calculated proforma to Claude for narrative generation and scenario analysis only.

## Integration Points

### External Services

| Service | Integration Pattern | Cache TTL | Notes |
|---------|---------------------|-----------|-------|
| Anthropic Claude API | Direct SDK call from agents, streaming mode | No cache (unique per analysis) | Use `claude-sonnet-4-5` with `web_search` tool. ~10-30s per agent call. |
| Rentcast | REST API via DataService | 14-30 days depending on endpoint | 50 calls/month global limit. Cache is survival-critical. |
| Census ACS | REST API via DataService | 90 days | Unlimited calls, no key needed for basic access. Data updates annually. |
| Census Geocoder | REST API via DataService | Permanent (address doesn't move) | No API key. Rate limit ~10 req/s but not a concern. |
| Walk Score | REST API via DataService | Permanent (scores change slowly) | Free tier limits exist. Cache aggressively. |
| Resend/Nodemailer | Fire-and-forget from cron endpoint | N/A | Email digest after scheduled finder runs. |
| Supabase Storage | Upload generated PDFs | N/A | Store PDFs with path like `{user_id}/{deal_id}/report.pdf`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client <-> Route Handlers | SSE stream (analysis), JSON (everything else) | Auth via Supabase session cookie |
| Client <-> Server Actions | RPC-style (Next.js handles serialization) | For mutations only. Returns revalidated path. |
| Route Handlers <-> AgentOrchestrator | Direct function call, async generator | Same process. No network boundary. |
| AgentOrchestrator <-> Individual Agents | Direct function call | Each agent is a class/function that returns structured output |
| Agents <-> DataService | Direct function call | Agent says "I need property data for X", DataService handles cache + provider |
| DataService <-> Providers | HTTP REST calls | Provider modules are thin wrappers around fetch() |
| DataService <-> Supabase | SQL via Supabase client | Cache reads/writes, usage log inserts |
| Cron Route <-> AgentOrchestrator | Direct function call (same as interactive, but events discarded) | Uses service-role client (bypasses RLS) |
| Server <-> Supabase Auth | JWT verification via middleware | `middleware.ts` refreshes session, server components use `createServerClient` |

## Suggested Build Order

Build order is driven by dependency chains and the TDD requirement for the underwriting engine.

| Phase | What to Build | Why This Order |
|-------|---------------|----------------|
| 1 | Supabase schema + RLS + Auth + middleware | Everything depends on the database and auth. Cannot test anything without it. |
| 2 | UnderwritingEngine (pure math) + unit tests | TDD requirement. Zero dependencies on UI or agents. Must be solid before anything uses it. |
| 3 | DataService + providers (Rentcast, Census, Walk Score) | Agents depend on DataService. Build + test the cache-first pattern with real API calls. |
| 4 | Agent framework (base agent + orchestrator) + first agent (Market Analysis) | Prove the streaming pattern end-to-end with one agent before building all five. |
| 5 | Remaining agents (Underwriting, Comparables, Verdict) + Finder | Now the pipeline works. Each agent is incremental. |
| 6 | Core UI screens (Dashboard, Pipeline, Analysis streaming, Deal Detail) | Backend is solid. Build the views. Analysis screen is the hardest (streaming consumer). |
| 7 | PDF generation | Depends on analysis data existing. Test `@sparticuz/chromium` on Vercel early. |
| 8 | Cron + email digest | Depends on Finder Agent working. Cron is the trigger, not the logic. |
| 9 | Remaining UI (Discovery, Compare, Portfolio, Settings, Admin) | Polish screens that use already-built backend capabilities. |

## Vercel-Specific Constraints Summary

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Function max duration: 300s (Hobby), 800s (Pro) | Analysis pipeline must complete within this window | Pipeline typically 60-120s. Safe on Hobby. Set `maxDuration = 300` explicitly. |
| Function bundle size: 250MB (uncompressed) | Puppeteer + Chromium is tight | Use `@sparticuz/chromium` (~50MB compressed). Keep PDF route in its own function (Next.js auto-splits). |
| Function memory: 2GB (Hobby), 4GB (Pro) | Chromium needs ~512MB-1GB | 2GB default is sufficient. |
| Cron: daily only on Hobby, +/- 59min | Finder scheduling is imprecise | Accept imprecision for Phase 0. Upgrade to Pro for Phase 1. |
| No persistent processes / no WebSockets | Cannot use long-running WebSocket connections | SSE via ReadableStream works perfectly. No WebSocket needed. |
| Cold starts: ~1-3s for normal functions, ~3-8s for Chromium | PDF generation has noticeable delay | Show loading state. Consider pre-warming if needed. |
| `/tmp` scratch space: 500MB | Chromium temporary files | Sufficient. No action needed. |
| Request body / response: 4.5MB limit | PDF files could exceed this | Store PDFs in Supabase Storage, return a signed URL instead of the raw PDF. |
| Streaming: supported on Node.js runtime | SSE works | Must NOT use Edge runtime for agent endpoints (need full Node.js for Anthropic SDK). |

## Sources

- Vercel Cron Jobs documentation: https://vercel.com/docs/cron-jobs (verified 2026-03-30) — HIGH confidence
- Vercel Cron Usage & Pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing (verified 2026-03-30) — HIGH confidence
- Vercel Functions Limits: https://vercel.com/docs/functions/limitations (verified 2026-03-30) — HIGH confidence
- Vercel Function Duration: https://vercel.com/docs/functions/configuring-functions/duration (verified 2026-03-30) — HIGH confidence
- Vercel Runtimes (streaming, filesystem): https://vercel.com/docs/functions/runtimes (verified 2026-03-30) — HIGH confidence
- Supabase RLS patterns: training data + Supabase documentation conventions — MEDIUM confidence (should verify auth.uid() syntax against current docs)
- `@sparticuz/chromium` for serverless Puppeteer: training data — MEDIUM confidence (verify package compatibility during implementation)
- Anthropic Claude API streaming: training data — MEDIUM confidence (verify current SDK streaming API)
- Next.js App Router Route Handlers + ReadableStream: training data + Next.js conventions — MEDIUM-HIGH confidence

---
*Architecture research for: DealStack — Agentic Real Estate Analysis SaaS*
*Researched: 2026-03-30*
