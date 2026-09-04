CREATE TYPE public.verification_status AS ENUM ('pending','verified','rejected');

ALTER TABLE public.profiles
  ADD COLUMN phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN id_type text,
  ADD COLUMN id_number text,
  ADD COLUMN document_path text,
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN verification_note text;

CREATE POLICY "admins update verification"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.book_token(_centre_id uuid, _commodity_id uuid, _slot_id uuid, _quantity numeric)
 RETURNS tokens
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _date date;
  _next integer;
  _row public.tokens;
  _status public.verification_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT verification_status INTO _status FROM public.profiles WHERE id = auth.uid();
  IF _status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Your farmer verification is % — booking is locked until an admin approves your details.', COALESCE(_status::text, 'missing');
  END IF;
  SELECT slot_date INTO _date FROM public.slots WHERE id = _slot_id AND centre_id = _centre_id;
  IF _date IS NULL THEN RAISE EXCEPTION 'Invalid slot'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_centre_id::text || _date::text));
  SELECT COALESCE(MAX(token_number),0)+1 INTO _next FROM public.tokens WHERE centre_id = _centre_id AND token_date = _date;
  INSERT INTO public.tokens (farmer_id, centre_id, commodity_id, slot_id, token_date, token_number, quantity)
  VALUES (auth.uid(), _centre_id, _commodity_id, _slot_id, _date, _next, _quantity)
  RETURNING * INTO _row;
  RETURN _row;
END;
$function$;