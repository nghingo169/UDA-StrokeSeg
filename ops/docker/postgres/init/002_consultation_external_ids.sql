-- Forward-compatible migration for databases initialized before consultation external IDs.
ALTER TABLE consultation_session ADD COLUMN IF NOT EXISTS external_id varchar(160);
UPDATE consultation_session SET external_id = 'LEGACY-' || consultation_id::text WHERE external_id IS NULL;
ALTER TABLE consultation_session ALTER COLUMN external_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_consultation_session_external_id ON consultation_session(external_id);

ALTER TABLE consultation_member ADD COLUMN IF NOT EXISTS external_user_id varchar(160);
UPDATE consultation_member SET external_user_id = COALESCE(user_id::text, 'LEGACY-' || consultation_id::text)
WHERE external_user_id IS NULL;
ALTER TABLE consultation_member ALTER COLUMN external_user_id SET NOT NULL;
ALTER TABLE consultation_member ADD COLUMN IF NOT EXISTS member_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
