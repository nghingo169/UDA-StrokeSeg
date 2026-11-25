-- Latest ERD alignment: UDA-StrokeSeg.
-- This migration is additive and keeps external IDs used by the current API.

-- Missing ERD attributes on existing aggregates.
ALTER TABLE role ADD COLUMN IF NOT EXISTS role_code varchar(80);
UPDATE role SET role_code = role_name WHERE role_code IS NULL;
ALTER TABLE role ALTER COLUMN role_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_role_code ON role(role_code);

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS organization varchar(200);
ALTER TABLE site_source ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE scanner ADD COLUMN IF NOT EXISTS field_strength numeric(5,2);
ALTER TABLE study ADD COLUMN IF NOT EXISTS baseline_nihss integer;
ALTER TABLE study ADD COLUMN IF NOT EXISTS accession_no varchar(160);
ALTER TABLE study ADD COLUMN IF NOT EXISTS qc_status varchar(40);
ALTER TABLE study ADD COLUMN IF NOT EXISTS qc_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE series ADD COLUMN IF NOT EXISTS affine_matrix jsonb;
ALTER TABLE series ADD COLUMN IF NOT EXISTS repetition_time_tr numeric(12,4);
ALTER TABLE series ADD COLUMN IF NOT EXISTS pixel_spacing jsonb;
ALTER TABLE series ADD COLUMN IF NOT EXISTS voxel_spacing jsonb;
ALTER TABLE storage_object ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE storage_object ADD COLUMN IF NOT EXISTS file_type varchar(120);
ALTER TABLE model ADD COLUMN IF NOT EXISTS model_description text;
ALTER TABLE model_version ADD COLUMN IF NOT EXISTS input_modalities jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE model_version ADD COLUMN IF NOT EXISTS deployment_status varchar(40) NOT NULL DEFAULT 'IMPORTED';
ALTER TABLE inference_task ADD COLUMN IF NOT EXISTS execution_status varchar(40);
UPDATE inference_task SET execution_status = status WHERE execution_status IS NULL;
ALTER TABLE segmentation_mask ADD COLUMN IF NOT EXISTS mask_type varchar(40);
ALTER TABLE segmentation_mask ADD COLUMN IF NOT EXISTS approval_status varchar(40) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE segmentation_mask ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE lesion_measurement ADD COLUMN IF NOT EXISTS severity_score numeric(8,4);
ALTER TABLE lesion_measurement ADD COLUMN IF NOT EXISTS vascular_territory varchar(120);
ALTER TABLE report ADD COLUMN IF NOT EXISTS qc_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE report ADD COLUMN IF NOT EXISTS generated_at timestamptz;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS study_id uuid REFERENCES study(study_id);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS device varchar(200);
ALTER TABLE consultation_session ADD COLUMN IF NOT EXISTS consensus_score numeric(8,4);
ALTER TABLE consultation_session ADD COLUMN IF NOT EXISTS trigger_reason text;
ALTER TABLE consultation_session ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE consultation_member ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE consultation_member ADD COLUMN IF NOT EXISTS agreement_with_ai varchar(80);

-- ERD: DomainAdaptationRun.
CREATE TABLE IF NOT EXISTS domain_adaptation_run (
    run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id varchar(160) UNIQUE,
    source_model_version_id uuid REFERENCES model_version(version_id),
    target_model_version_id uuid REFERENCES model_version(version_id),
    adapted_target_dataset text,
    validation_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    adapted boolean NOT NULL DEFAULT false,
    method varchar(120),
    baseline_target_dice numeric(8,5),
    adapted_target_dice numeric(8,5),
    created_by uuid REFERENCES app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE domain_adaptation_run
    ADD COLUMN IF NOT EXISTS adapted_target_dice numeric(8,5);

-- ERD: Reason used by quarantine/escalation/report review.
CREATE TABLE IF NOT EXISTS reason (
    reason_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_code varchar(80) NOT NULL UNIQUE,
    reason_type varchar(80) NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quarantine_log ADD COLUMN IF NOT EXISTS reason_id uuid REFERENCES reason(reason_id);

-- ERD: consultation artifacts are separate from the live session aggregate.
CREATE TABLE IF NOT EXISTS consultation_artifact (
    artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id uuid NOT NULL REFERENCES consultation_session(consultation_id) ON DELETE CASCADE,
    external_id varchar(160),
    scope varchar(80),
    mode varchar(80),
    scheduled_at timestamptz,
    location text,
    report_object_key text,
    created_by uuid REFERENCES app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ERD: explicit relationship tables that are useful for auditability.
CREATE TABLE IF NOT EXISTS study_responsibility (
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES app_user(user_id),
    responsibility varchar(80) NOT NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (study_id, user_id, responsibility)
);

CREATE TABLE IF NOT EXISTS study_report_link (
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    report_id uuid NOT NULL REFERENCES report(report_id) ON DELETE CASCADE,
    linked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (study_id, report_id)
);

CREATE TABLE IF NOT EXISTS study_audit_link (
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    log_id uuid NOT NULL REFERENCES audit_log(log_id) ON DELETE CASCADE,
    PRIMARY KEY (study_id, log_id)
);

CREATE INDEX IF NOT EXISTS ix_domain_adaptation_source ON domain_adaptation_run(source_model_version_id);
CREATE INDEX IF NOT EXISTS ix_consultation_artifact_session ON consultation_artifact(consultation_id);
CREATE INDEX IF NOT EXISTS ix_quarantine_reason ON quarantine_log(reason_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_timestamp ON audit_log(created_at DESC);

-- Seed the ERD's canonical role codes for existing installations.
INSERT INTO role (role_name, role_code, access_level, permissions) VALUES
    ('radiologist', 'radiologist', 30, '{"study.read": true, "mask.write": true, "report.sign": true}'::jsonb),
    ('physician', 'physician', 20, '{"study.read": true, "feedback.write": true, "consultation.join": true}'::jsonb),
    ('hod', 'hod', 40, '{"governance.manage": true, "consultation.assign": true}'::jsonb),
    ('it', 'it', 50, '{"system.manage": true, "audit.read": true}'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET role_code = EXCLUDED.role_code;
