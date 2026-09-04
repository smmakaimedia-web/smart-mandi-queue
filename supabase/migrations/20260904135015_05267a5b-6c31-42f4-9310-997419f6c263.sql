CREATE POLICY "farmer docs upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "farmer docs read own or admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'farmer-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "farmer docs update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'farmer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);