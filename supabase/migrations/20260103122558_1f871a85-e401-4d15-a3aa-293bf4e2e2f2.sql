-- Drop existing restrictive policies and recreate as permissive

-- Appointments
DROP POLICY IF EXISTS "Admins can manage appointments" ON appointments;
CREATE POLICY "Admins can manage appointments" ON appointments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Clinic Settings
DROP POLICY IF EXISTS "Admins can manage clinic_settings" ON clinic_settings;
CREATE POLICY "Admins can manage clinic_settings" ON clinic_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Consultation Types
DROP POLICY IF EXISTS "Admins can manage consultation_types" ON consultation_types;
CREATE POLICY "Admins can manage consultation_types" ON consultation_types
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Patients
DROP POLICY IF EXISTS "Admins can manage patients" ON patients;
CREATE POLICY "Admins can manage patients" ON patients
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Professionals
DROP POLICY IF EXISTS "Admins can manage professionals" ON professionals;
CREATE POLICY "Admins can manage professionals" ON professionals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Rooms
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;
CREATE POLICY "Admins can manage rooms" ON rooms
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Specialties
DROP POLICY IF EXISTS "Admins can manage specialties" ON specialties;
CREATE POLICY "Admins can manage specialties" ON specialties
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Waitlist
DROP POLICY IF EXISTS "Admins can manage waitlist" ON waitlist;
CREATE POLICY "Admins can manage waitlist" ON waitlist
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));