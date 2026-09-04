ALTER TABLE public.coding_assignments
  ADD COLUMN IF NOT EXISTS test_cases jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.coding_submissions
  ADD COLUMN IF NOT EXISTS test_results jsonb,
  ADD COLUMN IF NOT EXISTS auto_score numeric;