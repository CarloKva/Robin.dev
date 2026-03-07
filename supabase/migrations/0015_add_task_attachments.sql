-- =============================================================================
-- Migration 0015 · Add attachments to tasks + task-attachments storage bucket
-- =============================================================================
-- Adds a JSONB column `attachments` to the tasks table to store file metadata
-- (name, storage_path, mime_type) for images uploaded via ImageUploader.
-- Also creates the `task-attachments` Storage bucket with RLS policies so that
-- authenticated users can upload and read their task attachments.
-- =============================================================================

-- 1. Add attachments column
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Create storage bucket (private — not publicly accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for storage.objects
-- Allow authenticated users to upload into the bucket
CREATE POLICY "Authenticated users can upload task attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated users to read from the bucket
CREATE POLICY "Authenticated users can read task attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');
