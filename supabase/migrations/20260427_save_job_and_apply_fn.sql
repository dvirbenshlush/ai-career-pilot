-- SECURITY DEFINER function: bypasses RLS, runs as postgres
-- Called from the extension /api/jobs/apply route via admin client RPC

CREATE OR REPLACE FUNCTION save_job_and_apply(
  p_user_id   uuid,
  p_title     text,
  p_company   text,
  p_snippet   text,
  p_url       text,
  p_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_app_id uuid;
BEGIN
  -- Find existing job by fingerprint, or insert a new one
  IF p_fingerprint IS NOT NULL AND p_fingerprint != '' THEN
    SELECT id INTO v_job_id
    FROM job_opportunities
    WHERE user_id = p_user_id AND message_fingerprint = p_fingerprint
    LIMIT 1;
  END IF;

  IF v_job_id IS NULL THEN
    INSERT INTO job_opportunities (
      user_id, title, company, snippet, url,
      source, source_name, match_score,
      message_fingerprint, found_at
    ) VALUES (
      p_user_id, p_title, p_company, p_snippet, p_url,
      'extension', 'Chrome Extension', 70,
      NULLIF(p_fingerprint, ''), NOW()
    )
    RETURNING id INTO v_job_id;
  END IF;

  -- Find existing application or insert, always ensure status = applied
  SELECT id INTO v_app_id
  FROM applications
  WHERE user_id = p_user_id AND job_id = v_job_id
  LIMIT 1;

  IF v_app_id IS NULL THEN
    INSERT INTO applications (user_id, job_id, status, updated_at)
    VALUES (p_user_id, v_job_id, 'applied', NOW())
    RETURNING id INTO v_app_id;
  ELSE
    UPDATE applications
    SET status = 'applied', updated_at = NOW()
    WHERE id = v_app_id;
  END IF;

  RETURN jsonb_build_object(
    'jobId', v_job_id,
    'applicationId', v_app_id
  );
END;
$$;
