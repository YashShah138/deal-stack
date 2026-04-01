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
