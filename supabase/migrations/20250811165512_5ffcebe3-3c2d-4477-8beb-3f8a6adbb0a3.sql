-- Create public storage bucket for onboarding documents if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'onboarding-documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('onboarding-documents', 'onboarding-documents', true);
  END IF;
END$$;

-- Policies for the onboarding-documents bucket
-- Public read access
CREATE POLICY "Public can view onboarding documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'onboarding-documents');

-- Allow anyone (anon or authenticated) to upload to this bucket
CREATE POLICY "Anyone can upload onboarding documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'onboarding-documents');

-- Only admins can update files in this bucket
CREATE POLICY "Admins can update onboarding documents"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'onboarding-documents' AND has_role(auth.uid(), 'admin'));

-- Only admins can delete files in this bucket
CREATE POLICY "Admins can delete onboarding documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'onboarding-documents' AND has_role(auth.uid(), 'admin'));

-- Ensure realtime payloads include full row for updates on onboarding_applications
ALTER TABLE public.onboarding_applications REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'onboarding_applications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_applications';
  END IF;
END$$;