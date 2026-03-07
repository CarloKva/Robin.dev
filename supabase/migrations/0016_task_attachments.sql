-- Migration: add attachments column to tasks and create storage bucket for task images

-- Add attachments column (JSONB array of TaskAttachment objects)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Create storage bucket for task attachments (10 MB per file, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for task-attachments storage bucket
CREATE POLICY "task_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');
