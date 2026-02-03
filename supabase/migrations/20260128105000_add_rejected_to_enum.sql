-- Safe / idempotent migration: add 'rejected' to public.request_status only if needed

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'request_status'
  ) THEN

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'request_status'
        AND e.enumlabel = 'rejected'
    ) THEN
      ALTER TYPE public.request_status ADD VALUE 'rejected';
    END IF;

  END IF;
END
$$;
