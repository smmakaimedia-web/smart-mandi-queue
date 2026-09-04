
DROP POLICY "tokens read" ON public.tokens;
CREATE POLICY "queue readable by signed-in users" ON public.tokens FOR SELECT TO authenticated USING (true);
