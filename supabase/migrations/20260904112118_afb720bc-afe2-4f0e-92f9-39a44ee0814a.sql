
CREATE TYPE public.app_role AS ENUM ('farmer','operator','admin');
CREATE TYPE public.token_status AS ENUM ('booked','arrived','served','no_show');
CREATE TYPE public.payment_status AS ENUM ('pending','paid');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  village text,
  preferred_commodities text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  centre_id uuid,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE TABLE public.centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL
);
GRANT SELECT ON public.centres TO authenticated;
GRANT ALL ON public.centres TO service_role;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commodities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avg_service_time_minutes integer NOT NULL DEFAULT 10
);
GRANT SELECT ON public.commodities TO authenticated;
GRANT ALL ON public.commodities TO service_role;
ALTER TABLE public.commodities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  time_slot text NOT NULL,
  UNIQUE (centre_id, slot_date, time_slot)
);
GRANT SELECT ON public.slots TO authenticated;
GRANT ALL ON public.slots TO service_role;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  commodity_id uuid NOT NULL REFERENCES public.commodities(id),
  slot_id uuid NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  token_date date NOT NULL,
  token_number integer NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  status public.token_status NOT NULL DEFAULT 'booked',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, token_date, token_number)
);
GRANT SELECT, INSERT, UPDATE ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  served_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own roles insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "centres read" ON public.centres FOR SELECT TO authenticated USING (true);
CREATE POLICY "commodities read" ON public.commodities FOR SELECT TO authenticated USING (true);
CREATE POLICY "slots read" ON public.slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "tokens read" ON public.tokens FOR SELECT TO authenticated
  USING (farmer_id = auth.uid() OR public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tokens insert own" ON public.tokens FOR INSERT TO authenticated WITH CHECK (farmer_id = auth.uid());
CREATE POLICY "tokens update staff" ON public.tokens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "transactions read" ON public.transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.tokens t WHERE t.id = token_id AND t.farmer_id = auth.uid()));
CREATE POLICY "transactions write staff" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "transactions update staff" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operator') OR public.has_role(auth.uid(),'admin'));

-- Atomic sequential token booking (per centre, per day)
CREATE OR REPLACE FUNCTION public.book_token(_centre_id uuid, _commodity_id uuid, _slot_id uuid, _quantity numeric)
RETURNS public.tokens LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _date date;
  _next integer;
  _row public.tokens;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT slot_date INTO _date FROM public.slots WHERE id = _slot_id AND centre_id = _centre_id;
  IF _date IS NULL THEN RAISE EXCEPTION 'Invalid slot'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_centre_id::text || _date::text));
  SELECT COALESCE(MAX(token_number),0)+1 INTO _next FROM public.tokens WHERE centre_id = _centre_id AND token_date = _date;
  INSERT INTO public.tokens (farmer_id, centre_id, commodity_id, slot_id, token_date, token_number, quantity)
  VALUES (auth.uid(), _centre_id, _commodity_id, _slot_id, _date, _next, _quantity)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.book_token(uuid,uuid,uuid,numeric) TO authenticated;

ALTER TABLE public.tokens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;

-- Seed data
INSERT INTO public.centres (name, location) VALUES
  ('Kharkhoda Mandi','Sonipat, Haryana'),
  ('Rampur Procurement Centre','Barabanki, Uttar Pradesh'),
  ('Nashik APMC Yard','Nashik, Maharashtra'),
  ('Guntur Mandi','Guntur, Andhra Pradesh'),
  ('Bhatinda Grain Market','Bhatinda, Punjab');

INSERT INTO public.commodities (name, avg_service_time_minutes) VALUES
  ('Wheat',12),('Paddy',15),('Maize',10),('Mustard',8),
  ('Cotton',20),('Soybean',12),('Onion',9),('Sugarcane',18);

INSERT INTO public.slots (centre_id, slot_date, time_slot)
SELECT c.id, d::date, t
FROM public.centres c
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day') d
CROSS JOIN unnest(ARRAY['08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00','16:00 - 18:00']) t;
