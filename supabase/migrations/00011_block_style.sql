-- Per-block style: background color (from cover palette) + borderless toggle.
ALTER TABLE public.blocks
  ADD COLUMN style JSONB NOT NULL DEFAULT '{}'::jsonb;
