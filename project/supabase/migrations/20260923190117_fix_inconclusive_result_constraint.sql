/*
# Fix analyses table to accept 'inconclusive' result

## Problem
The `analyses` table has a CHECK constraint on the `result` column that only
allows `'authentic'` or `'manipulated'`. When the analysis pipeline returns
`'inconclusive'` (ambiguous evidence or low confidence), the INSERT fails
silently — the record is never saved, so it never appears in History.

## Changes
1. Drop the existing CHECK constraint on `analyses.result`
2. Add a new CHECK constraint allowing `'authentic'`, `'manipulated'`, and `'inconclusive'`
3. Add a `model_prediction` numeric column to store the raw CNN output (0-1)
4. Add `video_metadata` jsonb column for video-specific info (duration, fps, resolution, frame counts)

## Security
- No RLS policy changes — existing policies remain valid.
*/

ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_result_check;

ALTER TABLE analyses ADD CONSTRAINT analyses_result_check
  CHECK (result IN ('authentic', 'manipulated', 'inconclusive'));

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS model_prediction numeric(5,4) DEFAULT 0.5000;

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS video_metadata jsonb DEFAULT '{}';
