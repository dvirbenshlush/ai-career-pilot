-- Backfill: copy all existing scraped jobs to every user who doesn't have them yet.
-- Skips jobs the user already has (by message_fingerprint).
-- Sets match_score = 50 (neutral) for backfilled rows.

INSERT INTO job_opportunities (
  user_id, title, company, location, salary_range, remote, url,
  match_score, tags, source, source_name, snippet, experience_required,
  contact, raw_message, poster_name, message_fingerprint, found_at
)
SELECT
  u.id            AS user_id,
  j.title,
  j.company,
  j.location,
  j.salary_range,
  j.remote,
  j.url,
  50              AS match_score,
  j.tags,
  j.source,
  j.source_name,
  j.snippet,
  j.experience_required,
  j.contact,
  j.raw_message,
  j.poster_name,
  j.message_fingerprint,
  j.found_at
FROM
  -- one representative row per fingerprint (latest scan wins)
  (
    SELECT DISTINCT ON (message_fingerprint)
      title, company, location, salary_range, remote, url,
      tags, source, source_name, snippet, experience_required,
      contact, raw_message, poster_name, message_fingerprint, found_at
    FROM job_opportunities
    WHERE message_fingerprint IS NOT NULL
    ORDER BY message_fingerprint, found_at DESC
  ) j
  CROSS JOIN auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM job_opportunities x
  WHERE x.user_id = u.id
    AND x.message_fingerprint = j.message_fingerprint
)
ON CONFLICT (user_id, message_fingerprint) DO NOTHING;
