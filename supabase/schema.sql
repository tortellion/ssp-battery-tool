-- SSP Battery Configuration Tool — Database Schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ── Component Library (one shared record for the whole team) ──────────────
CREATE TABLE IF NOT EXISTS component_library (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          JSONB NOT NULL,
  previous_data JSONB,
  is_demo       BOOLEAN DEFAULT TRUE,
  updated_by    UUID REFERENCES auth.users(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Only one library record allowed
CREATE UNIQUE INDEX IF NOT EXISTS component_library_singleton ON component_library ((TRUE));

-- ── Configuration History ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configurations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) NOT NULL,
  company       TEXT,
  product       TEXT,
  vertical      TEXT,
  voltage       TEXT,
  capacity_wh   NUMERIC,
  spec_content  JSONB,
  cfg_summary   JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Settings (per user) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id),
  data      JSONB NOT NULL DEFAULT '{"margin_percent":40,"labor_rate":75,"base_hours":2,"per_cell_hours":0.5}'
);

-- ── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE component_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings     ENABLE ROW LEVEL SECURITY;

-- Library: any authenticated user can read
CREATE POLICY "Authenticated users can read library"
  ON component_library FOR SELECT
  TO authenticated USING (TRUE);

-- Library INSERT: any authenticated user can create the first (and only) row
CREATE POLICY "Authenticated users can insert library"
  ON component_library FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Library UPDATE: only the user who last wrote may overwrite, OR the row has no prior writer
-- This prevents any other authenticated user from silently wiping the library (C-1).
CREATE POLICY "Library writer can update library"
  ON component_library FOR UPDATE
  TO authenticated
  USING (updated_by IS NULL OR updated_by = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL);

-- Configurations: users see everyone's history (shared team view)
CREATE POLICY "Authenticated users can read all configurations"
  ON configurations FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Users can insert their own configurations"
  ON configurations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Settings: users can only read and write their own settings
CREATE POLICY "Users can manage their own settings"
  ON user_settings FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
