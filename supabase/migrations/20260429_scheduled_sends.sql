CREATE TABLE IF NOT EXISTS scheduled_cv_sends (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_opportunity_id  uuid        REFERENCES job_opportunities(id) ON DELETE SET NULL,
  job_title           text        NOT NULL,
  company             text,
  contact_email       text        NOT NULL,
  snippet             text,
  language            text        NOT NULL DEFAULT 'he',
  gender              text        NOT NULL DEFAULT 'male',
  scheduled_at        timestamptz NOT NULL,
  status              text        NOT NULL DEFAULT 'pending',
  error               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE scheduled_cv_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_sends_user" ON scheduled_cv_sends
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS scheduled_sends_due_idx
  ON scheduled_cv_sends (status, scheduled_at)
  WHERE status = 'pending';
