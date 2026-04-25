-- Replace partial unique index with a proper unique constraint so that
-- ON CONFLICT (user_id, message_fingerprint) works in PostgREST/upsert.
-- NULLs are always considered distinct in PostgreSQL unique constraints,
-- so rows without a fingerprint will never conflict with each other.

-- Normalize existing empty-string fingerprints to NULL
UPDATE job_opportunities SET message_fingerprint = NULL WHERE message_fingerprint = '';

-- Drop the partial index created in the previous migration
DROP INDEX IF EXISTS job_opportunities_user_fingerprint_unique;

-- Add a proper unique constraint (non-partial)
ALTER TABLE job_opportunities
  DROP CONSTRAINT IF EXISTS job_opportunities_user_fingerprint_unique;

ALTER TABLE job_opportunities
  ADD CONSTRAINT job_opportunities_user_fingerprint_unique
  UNIQUE (user_id, message_fingerprint);
