-- Allow authenticated users to insert their own profile row
CREATE POLICY "Users can insert own profile"
  ON "public"."user_profiles"
  AS permissive
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
