/*
# DeepGuard - AI Deepfake Detection Platform Schema

## Overview
Creates the complete database schema for DeepGuard, a deepfake detection and digital media forensics system. Users can upload images/videos for AI-based deepfake analysis, view detection history, download forensic reports, and track analytics.

## New Tables

1. **profiles** - Extended user profile data (full_name, role, organization, avatar_url)
   - Linked to auth.users via foreign key
   - Each user manages their own profile only

2. **analyses** - Core detection history table
   - id (uuid PK), user_id (FK to auth.users), analysis_id (text, human-readable like DG-XXXXXX)
   - file_name, media_type (image/video), file_size, mime_type
   - result (authentic/manipulated), confidence (numeric 0-1), risk_score (numeric 0-100)
   - visual_score, temporal_score, audio_score (nullable, numeric)
   - metadata_info (jsonb), forensic_indicators (jsonb), frame_results (jsonb)
   - model_name, processing_time_ms, status (completed/failed)
   - created_at

3. **analytics_events** - Aggregated analytics events for dashboard stats
   - id, user_id, event_type, event_data (jsonb), created_at

## Security
- RLS enabled on all tables
- profiles: users manage their own profile only
- analyses: users CRUD their own analyses only
- analytics_events: users insert/read their own events
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  organization text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id text NOT NULL DEFAULT 'DG-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  file_name text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  result text NOT NULL DEFAULT 'authentic' CHECK (result IN ('authentic', 'manipulated')),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  risk_score numeric(5,2) NOT NULL DEFAULT 50.00,
  visual_score numeric(5,2),
  temporal_score numeric(5,2),
  audio_score numeric(5,2),
  metadata_info jsonb DEFAULT '{}',
  forensic_indicators jsonb DEFAULT '[]',
  frame_results jsonb DEFAULT '[]',
  heatmap_data text,
  model_name text NOT NULL DEFAULT 'DeepGuard-CNN-v1',
  processing_time_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'processing')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analyses" ON analyses;
CREATE POLICY "select_own_analyses" ON analyses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analyses" ON analyses;
CREATE POLICY "insert_own_analyses" ON analyses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analyses" ON analyses;
CREATE POLICY "update_own_analyses" ON analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_analyses" ON analyses;
CREATE POLICY "delete_own_analyses" ON analyses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_events" ON analytics_events;
CREATE POLICY "select_own_events" ON analytics_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_events" ON analytics_events;
CREATE POLICY "insert_own_events" ON analytics_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_events" ON analytics_events;
CREATE POLICY "delete_own_events" ON analytics_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_result ON analyses(result);
CREATE INDEX IF NOT EXISTS idx_analyses_media_type ON analyses(media_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();