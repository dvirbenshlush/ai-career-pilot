-- Step 1: Remove duplicate job_opportunities rows
-- For rows with a fingerprint, keep the one with the earliest found_at
DELETE FROM job_opportunities
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, message_fingerprint
             ORDER BY found_at ASC
           ) AS rn
    FROM job_opportunities
    WHERE message_fingerprint IS NOT NULL
      AND message_fingerprint <> ''
  ) ranked
  WHERE rn > 1
);

-- For rows without a fingerprint, dedup by (user_id, title, company, source)
DELETE FROM job_opportunities
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, title, company, source
             ORDER BY found_at ASC
           ) AS rn
    FROM job_opportunities
    WHERE (message_fingerprint IS NULL OR message_fingerprint = '')
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add a unique partial index to prevent future duplicates at DB level
-- (partial: only enforced when fingerprint is not null/empty)
CREATE UNIQUE INDEX IF NOT EXISTS job_opportunities_user_fingerprint_unique
  ON job_opportunities (user_id, message_fingerprint)
  WHERE message_fingerprint IS NOT NULL AND message_fingerprint <> '';
