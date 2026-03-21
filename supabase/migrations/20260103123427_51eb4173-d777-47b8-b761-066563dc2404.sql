-- Table for public appointment requests (no auth required)
CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nif TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('dentaria', 'oftalmologia')),
  preferred_date DATE NOT NULL,
  preferred_time TIME WITHOUT TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID
);

-- Enable RLS
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert (anyone can submit a request)
CREATE POLICY "Anyone can submit appointment requests"
ON public.appointment_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can manage appointment requests"
ON public.appointment_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_appointment_requests_updated_at
BEFORE UPDATE ON public.appointment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Table for contact messages (no auth required)
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert (anyone can send a message)
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can manage contact messages"
ON public.contact_messages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));