CREATE TABLE IF NOT EXISTS studio_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  job_allowance integer NOT NULL DEFAULT 20 CHECK (job_allowance >= 0),
  jobs_used integer NOT NULL DEFAULT 0 CHECK (jobs_used >= 0),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS studio_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  job_allowance integer NOT NULL DEFAULT 20,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS studio_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES studio_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_sessions_user_idx ON studio_sessions(user_id);
CREATE TABLE IF NOT EXISTS studio_rate_limits (
  bucket text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_uploads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES studio_users(id),
  pathname text NOT NULL UNIQUE,
  blob_url text,
  name text NOT NULL,
  size bigint NOT NULL CHECK (size > 0),
  content_type text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('prd','asset','reference')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','rejected','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz
);
CREATE INDEX IF NOT EXISTS studio_uploads_user_idx ON studio_uploads(user_id, created_at);
CREATE TABLE IF NOT EXISTS studio_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES studio_users(id),
  idempotency_key uuid NOT NULL,
  input_hash text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','reading','planning','rendering','checking','ready','needs_input','needs_review','failed','cancelled')),
  input jsonb NOT NULL,
  uploads jsonb NOT NULL DEFAULT '[]',
  stages jsonb NOT NULL DEFAULT '[{"stage":"queued"}]',
  checkpoint jsonb NOT NULL DEFAULT '{}',
  artifacts jsonb NOT NULL DEFAULT '{}',
  runtime_version text NOT NULL,
  skill_version text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  worker_id text,
  video jsonb,
  poster jsonb,
  quality jsonb,
  quality_passed boolean NOT NULL DEFAULT false,
  duration_seconds double precision,
  width integer,
  height integer,
  cost_usd numeric CHECK (cost_usd >= 0),
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  UNIQUE(user_id,idempotency_key),
  CHECK (status <> 'ready' OR (quality_passed AND video IS NOT NULL AND poster IS NOT NULL AND quality IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS studio_jobs_owner_idx ON studio_jobs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS studio_jobs_queue_idx ON studio_jobs(status,available_at);
CREATE TABLE IF NOT EXISTS studio_artifact_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES studio_jobs(id) ON DELETE CASCADE,
  lease_token uuid NOT NULL,
  relative_path text NOT NULL,
  pathname text NOT NULL UNIQUE,
  size bigint NOT NULL CHECK(size>0),
  content_type text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_artifact_reservations_job_idx ON studio_artifact_reservations(job_id);

CREATE OR REPLACE FUNCTION studio_reserve_artifact(p_job uuid,p_lease uuid,p_path text,p_pathname text,p_size bigint,p_type text)
RETURNS SETOF studio_artifact_reservations LANGUAGE plpgsql AS $$
DECLARE active studio_jobs; reservation studio_artifact_reservations;
BEGIN
  SELECT * INTO active FROM studio_jobs WHERE id=p_job AND lease_token=p_lease AND lease_expires_at>now() AND expires_at>now() AND status IN ('reading','planning','rendering','checking') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  IF p_size<=0 OR p_size>838860800 OR (SELECT coalesce(sum(size),0) FROM studio_artifact_reservations WHERE job_id=p_job)+p_size>2147483648 OR (SELECT count(*) FROM studio_artifact_reservations WHERE job_id=p_job)>=400 THEN RAISE EXCEPTION 'ARTIFACT_BUDGET'; END IF;
  IF p_pathname NOT LIKE 'jobs/'||p_job::text||'/%' THEN RAISE EXCEPTION 'ARTIFACT_SCOPE'; END IF;
  INSERT INTO studio_artifact_reservations(job_id,lease_token,relative_path,pathname,size,content_type) VALUES(p_job,p_lease,p_path,p_pathname,p_size,p_type) RETURNING * INTO reservation;
  RETURN NEXT reservation;
END $$;

CREATE OR REPLACE FUNCTION studio_complete_artifact(p_job uuid,p_lease uuid,p_reservation uuid,p_path text,p_artifact jsonb)
RETURNS SETOF studio_jobs LANGUAGE plpgsql AS $$
DECLARE active studio_jobs; reservation studio_artifact_reservations;
BEGIN
  SELECT * INTO active FROM studio_jobs WHERE id=p_job AND lease_token=p_lease AND lease_expires_at>now() AND expires_at>now() AND status IN ('reading','planning','rendering','checking') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
  SELECT * INTO reservation FROM studio_artifact_reservations WHERE id=p_reservation AND job_id=p_job AND lease_token=p_lease FOR UPDATE;
  IF NOT FOUND OR reservation.relative_path<>p_path OR reservation.pathname<>p_artifact->>'pathname' OR reservation.content_type<>p_artifact->>'contentType' OR reservation.size<>(p_artifact->>'size')::bigint THEN RAISE EXCEPTION 'ARTIFACT_MISMATCH'; END IF;
  -- Replaying an older completion must never overwrite a newer checkpoint file.
  IF reservation.completed_at IS NOT NULL THEN RETURN NEXT active; RETURN; END IF;
  IF EXISTS(SELECT 1 FROM studio_artifact_reservations WHERE job_id=p_job AND relative_path=p_path AND created_at>reservation.created_at AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'ARTIFACT_SUPERSEDED'; END IF;
  UPDATE studio_artifact_reservations SET completed_at=now() WHERE id=p_reservation;
  UPDATE studio_jobs SET artifacts=artifacts||jsonb_build_object(p_path,p_artifact||jsonb_build_object('reservationId',p_reservation)),updated_at=now() WHERE id=p_job RETURNING * INTO active;
  RETURN NEXT active;
END $$;

CREATE OR REPLACE FUNCTION studio_prepare_upload(p_id uuid,p_user uuid,p_path text,p_name text,p_size bigint,p_type text,p_kind text,p_max_files integer,p_max_bytes bigint)
RETURNS SETOF studio_uploads LANGUAGE plpgsql AS $$
DECLARE created studio_uploads;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  IF NOT EXISTS(SELECT 1 FROM studio_users WHERE id=p_user AND disabled_at IS NULL) THEN RAISE EXCEPTION 'ACCOUNT_DISABLED'; END IF;
  IF (SELECT count(*) FROM studio_uploads WHERE user_id=p_user AND status IN ('pending','ready') AND created_at>now()-interval '1 hour')>=p_max_files
    OR (SELECT coalesce(sum(size),0) FROM studio_uploads WHERE user_id=p_user AND status IN ('pending','ready') AND created_at>now()-interval '1 hour')+p_size>p_max_bytes THEN RAISE EXCEPTION 'UPLOAD_RATE_LIMIT'; END IF;
  INSERT INTO studio_uploads(id,user_id,pathname,name,size,content_type,kind,expires_at) VALUES(p_id,p_user,p_path,p_name,p_size,p_type,p_kind,now()+interval '1 day') RETURNING * INTO created;
  RETURN NEXT created;
END $$;

-- A locked invitation can only be consumed once, including concurrent redemptions.
CREATE OR REPLACE FUNCTION studio_redeem_invitation(p_hash text, p_session text)
RETURNS SETOF studio_users LANGUAGE plpgsql AS $$
DECLARE invitation studio_invitations; member studio_users;
BEGIN
  SELECT * INTO invitation FROM studio_invitations WHERE token_hash=p_hash AND redeemed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
  INSERT INTO studio_users(email,name,is_admin,job_allowance)
    VALUES(invitation.email,invitation.name,invitation.is_admin,invitation.job_allowance)
    ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING * INTO member;
  IF member.disabled_at IS NOT NULL THEN RAISE EXCEPTION 'ACCOUNT_DISABLED'; END IF;
  UPDATE studio_invitations SET redeemed_at=now() WHERE id=invitation.id;
  INSERT INTO studio_sessions(token_hash,user_id,expires_at) VALUES(p_session,member.id,now()+interval '30 days');
  RETURN NEXT member;
END $$;

-- The advisory lock serializes submissions by owner. Each statement after the lock
-- sees the preceding commit, avoiding count-then-insert races across API functions.
CREATE OR REPLACE FUNCTION studio_create_job(p_user uuid,p_key uuid,p_hash text,p_title text,p_input jsonb,p_upload_ids uuid[],p_active integer,p_daily integer,p_files integer,p_bytes bigint,p_retention integer,p_runtime text,p_skill text)
RETURNS SETOF studio_jobs LANGUAGE plpgsql AS $$
DECLARE existing studio_jobs; member studio_users; inventory jsonb; found_count integer; total_bytes bigint; created studio_jobs;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  SELECT * INTO existing FROM studio_jobs WHERE user_id=p_user AND idempotency_key=p_key;
  IF FOUND THEN
    IF existing.input_hash<>p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN NEXT existing; RETURN;
  END IF;
  SELECT * INTO member FROM studio_users WHERE id=p_user AND disabled_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_DISABLED'; END IF;
  IF member.jobs_used >= member.job_allowance THEN RAISE EXCEPTION 'BETA_ALLOWANCE'; END IF;
  IF (SELECT count(*) FROM studio_jobs WHERE user_id=p_user AND created_at>now()-interval '24 hours') >= p_daily THEN RAISE EXCEPTION 'DAILY_LIMIT'; END IF;
  IF (SELECT count(*) FROM studio_jobs WHERE user_id=p_user AND status IN ('queued','reading','planning','rendering','checking')) >= p_active THEN RAISE EXCEPTION 'ACTIVE_LIMIT'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'size',size,'contentType',content_type,'kind',kind,'pathname',pathname,'url',blob_url) ORDER BY id),'[]'),count(*),coalesce(sum(size),0)
    INTO inventory,found_count,total_bytes FROM studio_uploads WHERE id=ANY(p_upload_ids) AND user_id=p_user AND status='ready' AND expires_at>now();
  IF found_count<>cardinality(p_upload_ids) THEN RAISE EXCEPTION 'UPLOAD_UNAVAILABLE'; END IF;
  IF found_count>p_files OR total_bytes>p_bytes THEN RAISE EXCEPTION 'UPLOAD_LIMIT'; END IF;
  IF (SELECT count(*) FROM studio_uploads WHERE id=ANY(p_upload_ids) AND kind='reference')>1 THEN RAISE EXCEPTION 'REFERENCE_LIMIT'; END IF;
  IF p_input->>'mode'='prd' AND ((SELECT count(*) FROM studio_uploads WHERE id=ANY(p_upload_ids) AND kind='prd')<>1 OR (SELECT count(*) FROM studio_uploads WHERE id=ANY(p_upload_ids) AND kind='asset')<1) THEN RAISE EXCEPTION 'PRD_REQUIREMENTS'; END IF;
  IF p_input->>'mode'='url' AND EXISTS(SELECT 1 FROM studio_uploads WHERE id=ANY(p_upload_ids) AND kind='prd') THEN RAISE EXCEPTION 'UNEXPECTED_PRD'; END IF;
  IF coalesce(p_input->>'referenceUrl','')<>'' AND EXISTS(SELECT 1 FROM studio_uploads WHERE id=ANY(p_upload_ids) AND kind='reference') THEN RAISE EXCEPTION 'REFERENCE_LIMIT'; END IF;
  INSERT INTO studio_jobs(user_id,idempotency_key,input_hash,title,input,uploads,stages,expires_at,runtime_version,skill_version)
    VALUES(p_user,p_key,p_hash,p_title,p_input,inventory,jsonb_build_array(jsonb_build_object('stage','queued','at',now())),now()+make_interval(days=>p_retention),p_runtime,p_skill) RETURNING * INTO created;
  UPDATE studio_uploads SET expires_at=GREATEST(expires_at,created.expires_at) WHERE id=ANY(p_upload_ids);
  UPDATE studio_users SET jobs_used=jobs_used+1 WHERE id=p_user;
  RETURN NEXT created;
END $$;

CREATE OR REPLACE FUNCTION studio_claim_job(p_worker text,p_max_attempts integer,p_lease_seconds integer,p_global_concurrency integer,p_user_concurrency integer)
RETURNS SETOF studio_jobs LANGUAGE plpgsql AS $$
DECLARE selected studio_jobs;
BEGIN
  -- A single short dispatcher lock enforces global and owner concurrency atomically.
  PERFORM pg_advisory_xact_lock(hashtextextended('video-studio-dispatch',0));
  UPDATE studio_jobs SET status=CASE WHEN attempts>=p_max_attempts THEN 'failed' ELSE 'queued' END,
    error=CASE WHEN attempts>=p_max_attempts THEN '{"code":"WORKER_INTERRUPTED","message":"The rendering worker stopped before finishing.","action":"Submit the video again. Your original files are still available."}'::jsonb ELSE NULL END,
    lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now(),available_at=now(),
    completed_at=CASE WHEN attempts>=p_max_attempts THEN now() ELSE NULL END
    WHERE status IN ('reading','planning','rendering','checking') AND lease_expires_at<now();
  IF (SELECT count(*) FROM studio_jobs WHERE status IN ('reading','planning','rendering','checking') AND lease_expires_at>now())>=p_global_concurrency THEN RETURN; END IF;
  SELECT j.* INTO selected FROM studio_jobs j JOIN studio_users u ON u.id=j.user_id
    WHERE j.status='queued' AND j.available_at<=now() AND j.attempts<p_max_attempts AND j.expires_at>now() AND u.disabled_at IS NULL
    AND (SELECT count(*) FROM studio_jobs running WHERE running.user_id=j.user_id AND running.status IN ('reading','planning','rendering','checking') AND running.lease_expires_at>now())<p_user_concurrency
    ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE studio_jobs SET status='reading',lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),worker_id=p_worker,
    attempts=attempts+1,started_at=coalesce(started_at,now()),updated_at=now(),
    stages=stages||jsonb_build_array(jsonb_build_object('stage','reading','at',now()))
    WHERE id=selected.id RETURNING * INTO selected;
  RETURN NEXT selected;
END $$;
