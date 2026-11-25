-- UDA-StrokeSeg initial relational schema.
-- DICOM files and generated artefacts live in object storage; PostgreSQL stores metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_state (
    state_key varchar(80) PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user (
    user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(120) NOT NULL UNIQUE,
    email varchar(320) UNIQUE,
    full_name varchar(200) NOT NULL,
    department varchar(160),
    employee_id varchar(80) UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role (
    role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name varchar(80) NOT NULL UNIQUE,
    access_level smallint NOT NULL DEFAULT 1,
    permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Keep canonical role codes available when this migration is re-run after
-- the additive ERD migration has already made role_code NOT NULL.
ALTER TABLE role ADD COLUMN IF NOT EXISTS role_code varchar(80);
UPDATE role SET role_code = role_name WHERE role_code IS NULL;

CREATE TABLE IF NOT EXISTS user_role (
    user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS site_source (
    site_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code varchar(80) NOT NULL UNIQUE,
    site_name varchar(200) NOT NULL,
    site_type varchar(80),
    timezone varchar(80) NOT NULL DEFAULT 'UTC',
    description text
);

CREATE TABLE IF NOT EXISTS scanner (
    scanner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES site_source(site_id),
    vendor varchar(120),
    model_name varchar(160),
    protocol_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (site_id, vendor, model_name)
);

CREATE TABLE IF NOT EXISTS patient (
    patient_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_patient_ref varchar(160) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study (
    study_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id varchar(160) NOT NULL UNIQUE,
    patient_id uuid NOT NULL REFERENCES patient(patient_id),
    site_id uuid REFERENCES site_source(site_id),
    scanner_id uuid REFERENCES scanner(scanner_id),
    accession_number varchar(160) NOT NULL UNIQUE,
    study_instance_uid varchar(192) UNIQUE,
    acquired_at timestamptz,
    symptom_onset_time timestamptz,
    status varchar(40) NOT NULL DEFAULT 'RECEIVED',
    stroke_type varchar(80),
    qc_status varchar(40),
    qc_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    assigned_user_id uuid REFERENCES app_user(user_id),
    clinical_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
    series_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    series_instance_uid varchar(192) UNIQUE,
    modality varchar(32) NOT NULL,
    series_number integer,
    sequence_type varchar(80),
    slice_thickness numeric(8,3),
    file_count integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS storage_object (
    storage_object_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id uuid REFERENCES series(series_id) ON DELETE CASCADE,
    bucket varchar(120) NOT NULL,
    object_key text NOT NULL UNIQUE,
    file_size bigint,
    file_hash varchar(128),
    mime_type varchar(120),
    location jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model (
    model_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name varchar(160) NOT NULL UNIQUE,
    model_description text,
    vendor varchar(120)
);

CREATE TABLE IF NOT EXISTS model_version (
    version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id uuid NOT NULL REFERENCES model(model_id) ON DELETE CASCADE,
    version_tag varchar(80) NOT NULL,
    hyperparameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    architecture varchar(120),
    deployed_at timestamptz,
    deployment_status varchar(40) NOT NULL DEFAULT 'IMPORTED',
    UNIQUE (model_id, version_tag)
);

CREATE TABLE IF NOT EXISTS inference_task (
    task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    version_id uuid REFERENCES model_version(version_id),
    status varchar(40) NOT NULL DEFAULT 'QUEUED',
    execution_queue varchar(120),
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    input_modalities jsonb NOT NULL DEFAULT '[]'::jsonb,
    output_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Keep the task timeline queryable for both fresh installs and databases
-- created from an older version of this schema.
ALTER TABLE inference_task
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS segmentation_mask (
    mask_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    task_id uuid REFERENCES inference_task(task_id),
    parent_mask_id uuid REFERENCES segmentation_mask(mask_id),
    mask_type varchar(40) NOT NULL,
    version_no integer NOT NULL DEFAULT 1,
    object_key text,
    approval_status varchar(40) NOT NULL DEFAULT 'DRAFT',
    dice_score numeric(8,5),
    created_by uuid REFERENCES app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (study_id, mask_type, version_no)
);

CREATE TABLE IF NOT EXISTS lesion_measurement (
    measurement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mask_id uuid NOT NULL REFERENCES segmentation_mask(mask_id) ON DELETE CASCADE,
    lesion_volume numeric(12,4),
    diameter numeric(12,4),
    surface_area numeric(12,4),
    cluster_count integer,
    laterality varchar(32),
    vascular_territory varchar(120),
    position jsonb,
    measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report (
    report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    report_version integer NOT NULL DEFAULT 1,
    status varchar(40) NOT NULL DEFAULT 'DRAFT',
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    generated_at timestamptz,
    signed_by uuid REFERENCES app_user(user_id),
    signed_at timestamptz,
    pdf_object_key text,
    UNIQUE (study_id, report_version)
);

CREATE TABLE IF NOT EXISTS consultation_session (
    consultation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id varchar(160) NOT NULL UNIQUE,
    study_id uuid NOT NULL REFERENCES study(study_id),
    requested_by uuid REFERENCES app_user(user_id),
    lead_chair_id uuid REFERENCES app_user(user_id),
    status varchar(40) NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    meeting_provider varchar(40) NOT NULL DEFAULT 'zoom',
    provider_meeting_id varchar(120),
    provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    consensus_notes text,
    digital_signature text,
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultation_member (
    consultation_id uuid NOT NULL REFERENCES consultation_session(consultation_id) ON DELETE CASCADE,
    user_id uuid REFERENCES app_user(user_id),
    external_user_id varchar(160) NOT NULL,
    member_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    role_in_session varchar(40) NOT NULL DEFAULT 'PARTICIPANT',
    joined_at timestamptz,
    left_at timestamptz,
    PRIMARY KEY (consultation_id, external_user_id)
);

CREATE TABLE IF NOT EXISTS clinical_feedback (
    feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid NOT NULL REFERENCES study(study_id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES app_user(user_id),
    agreement_with_ai boolean,
    clinical_utility_rating smallint,
    treatment_decision text,
    comments text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid REFERENCES study(study_id),
    user_id uuid REFERENCES app_user(user_id),
    action varchar(120) NOT NULL,
    entity_type varchar(80),
    entity_id uuid,
    ip inet,
    device varchar(200),
    payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quarantine_log (
    quarantine_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id uuid REFERENCES study(study_id),
    reason_code varchar(80) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_study_status ON study(status);
CREATE INDEX IF NOT EXISTS ix_study_site_acquired ON study(site_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS ix_series_study ON series(study_id);
CREATE INDEX IF NOT EXISTS ix_inference_task_status ON inference_task(status, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);

INSERT INTO role (role_name, role_code, access_level, permissions) VALUES
    ('radiologist', 'radiologist', 30, '{"study.read": true, "mask.write": true, "report.sign": true}'::jsonb),
    ('physician', 'physician', 20, '{"study.read": true, "feedback.write": true, "consultation.join": true}'::jsonb),
    ('hod', 'hod', 40, '{"governance.manage": true, "consultation.assign": true}'::jsonb),
    ('it', 'it', 50, '{"system.manage": true, "audit.read": true}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;
