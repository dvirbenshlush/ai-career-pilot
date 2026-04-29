CREATE TABLE IF NOT EXISTS interviews (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_opportunity_id  uuid        REFERENCES job_opportunities(id) ON DELETE SET NULL,
  title               text        NOT NULL,
  company             text,
  interview_date      date        NOT NULL,
  interview_time      time,
  location            text,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interviews_user_policy" ON interviews
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS interviews_user_date_idx ON interviews (user_id, interview_date);
