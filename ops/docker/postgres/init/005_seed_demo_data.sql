-- Deterministic synthetic dataset for the lecturer demo.
--
-- This file is intentionally idempotent: PostgreSQL executes init scripts only
-- for a new volume, while local demo users often re-run the seed manually.
-- Passwords are not stored here. Demo authentication uses UDA_DEMO_PASSWORD
-- and the HRM adapter resolves these identities from app_user/user_role.

BEGIN;

-- Keep the HRM directory complete even when this seed is run against an older
-- database that did not yet receive 004_seed_erd_users.sql.
INSERT INTO role (role_name, role_code, access_level, permissions) VALUES
    ('radiologist', 'radiologist', 30, '{"study.read": true, "mask.write": true, "report.sign": true}'::jsonb),
    ('physician', 'physician', 20, '{"study.read": true, "feedback.write": true, "consultation.join": true}'::jsonb),
    ('hod', 'hod', 40, '{"governance.manage": true, "consultation.assign": true}'::jsonb),
    ('it', 'it', 50, '{"system.manage": true, "audit.read": true}'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET
    role_code = EXCLUDED.role_code,
    access_level = EXCLUDED.access_level,
    permissions = EXCLUDED.permissions;

INSERT INTO app_user (user_id, username, email, full_name, department, organization, employee_id)
VALUES
    ('00000000-0000-0000-0000-000000000011', 'lena.morgan', 'lena.morgan@uda.local', 'Dr. Lena Morgan', 'Radiology', 'UDA Emergency Hospital', 'RAD-011'),
    ('00000000-0000-0000-0000-000000000014', 'priya.shah', 'priya.shah@uda.local', 'Dr. Priya Shah', 'Radiology', 'UDA Emergency Hospital', 'RAD-014'),
    ('00000000-0000-0000-0000-000000000024', 'maya.harris', 'maya.harris@uda.local', 'Dr. Maya Harris', 'Stroke Medicine', 'UDA Emergency Hospital', 'PHY-024'),
    ('00000000-0000-0000-0000-000000000003', 'thomas.nguyen', 'thomas.nguyen@uda.local', 'Dr. Thomas Nguyen', 'Neurology', 'UDA Emergency Hospital', 'HOD-003'),
    ('00000000-0000-0000-0000-000000000008', 'alex.nguyen', 'alex.nguyen@uda.local', 'Alex Nguyen', 'IT', 'UDA Emergency Hospital', 'IT-008'),
    ('00000000-0000-0000-0000-000000000031', 'noah.williams', 'noah.williams@uda.local', 'Dr. Noah Williams', 'Radiology', 'UDA Emergency Hospital', 'RAD-031')
ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    department = EXCLUDED.department, organization = EXCLUDED.organization,
    employee_id = EXCLUDED.employee_id, is_active = true, updated_at = now();

INSERT INTO user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u
JOIN role r ON r.role_name = CASE
    WHEN u.username IN ('lena.morgan', 'priya.shah', 'noah.williams') THEN 'radiologist'
    WHEN u.username = 'maya.harris' THEN 'physician'
    WHEN u.username = 'thomas.nguyen' THEN 'hod'
    ELSE 'it' END
WHERE u.username IN ('lena.morgan', 'priya.shah', 'maya.harris', 'thomas.nguyen', 'alex.nguyen', 'noah.williams')
ON CONFLICT DO NOTHING;

INSERT INTO site_source (site_id, site_code, site_name, site_type, timezone, description)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'UDA-ER', 'UDA Emergency Hospital', 'Emergency hospital', 'Asia/Ho_Chi_Minh', 'Synthetic primary emergency stroke center'),
    ('10000000-0000-0000-0000-000000000002', 'UDA-REF', 'UDA Referral Center', 'Referral center', 'Asia/Ho_Chi_Minh', 'Synthetic partner site for multi-center demo')
ON CONFLICT (site_id) DO UPDATE SET site_name = EXCLUDED.site_name, description = EXCLUDED.description;

INSERT INTO scanner (scanner_id, site_id, vendor, model_name, field_strength, protocol_config)
VALUES
    ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Siemens', 'MAGNETOM Sola', 1.5, '{"sequences": ["DWI", "ADC", "FLAIR"], "synthetic": true}'::jsonb),
    ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'GE', 'SIGNA Explorer', 1.5, '{"sequences": ["DWI", "ADC", "FLAIR"], "synthetic": true}'::jsonb)
ON CONFLICT (scanner_id) DO UPDATE SET protocol_config = EXCLUDED.protocol_config;

INSERT INTO patient (patient_id, external_patient_ref)
VALUES
    ('12000000-0000-0000-0000-000000000084', 'BN-7A42'),
    ('12000000-0000-0000-0000-000000000079', 'BN-3C91'),
    ('12000000-0000-0000-0000-000000000077', 'BN-8D16'),
    ('12000000-0000-0000-0000-000000000071', 'BN-2F08'),
    ('12000000-0000-0000-0000-000000000063', 'BN-1E74'),
    ('12000000-0000-0000-0000-000000000058', 'BN-5B22'),
    ('12000000-0000-0000-0000-000000000041', 'BN-9C04')
ON CONFLICT (patient_id) DO UPDATE SET external_patient_ref = EXCLUDED.external_patient_ref;

INSERT INTO study (study_id, external_id, patient_id, site_id, scanner_id, accession_number, study_instance_uid,
                   acquired_at, symptom_onset_time, status, stroke_type, qc_status, qc_details, assigned_user_id, clinical_data)
VALUES
    ('20000000-0000-0000-0000-000000000084', 'AIS-240913-084', '12000000-0000-0000-0000-000000000084', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-084', '1.2.840.113619.2.55.084', now() - interval '2 hours', now() - interval '3 hours 38 minutes', 'Critical', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000011', '{"patient": "BN-7A42", "age": 67, "sex": "Male", "onset": "01:38", "received": "08:42", "sla": 11, "case_state": "AwaitingReview", "volume": 18.6, "side": "Left hemisphere", "territory": "MCA", "nihss": 14, "clusters": 2, "confidence": 0.91, "dice_score": 0.86, "threshold": 0.45, "missing_inputs": [], "assignee": "Dr. Lena Morgan", "progress": "waiting", "mask_version": "System draft 01", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000079', 'AIS-240913-079', '12000000-0000-0000-0000-000000000079', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-079', '1.2.840.113619.2.55.079', now() - interval '3 hours', now() - interval '4 hours 15 minutes', 'Critical', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000014', '{"patient": "BN-3C91", "age": 58, "sex": "Female", "onset": "02:15", "received": "08:31", "sla": 18, "case_state": "AwaitingReview", "volume": 7.2, "side": "Right hemisphere", "territory": "PCA", "nihss": 9, "clusters": 1, "confidence": 0.84, "dice_score": 0.79, "threshold": 0.45, "missing_inputs": ["Clinical onset time unverified"], "assignee": "Dr. Priya Shah", "progress": "in_progress", "mask_version": "System draft 01", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000077', 'AIS-240913-077', '12000000-0000-0000-0000-000000000077', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-077', '1.2.840.113619.2.55.077', now() - interval '4 hours', now() - interval '5 hours', 'Priority', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000011', '{"patient": "BN-8D16", "age": 72, "sex": "Female", "onset": "Unknown", "received": "08:17", "sla": 24, "case_state": "AwaitingReview", "volume": 3.8, "side": "Left hemisphere", "territory": "ACA", "nihss": 6, "clusters": 3, "confidence": 0.72, "dice_score": 0.68, "threshold": 0.45, "missing_inputs": ["Symptom onset unknown", "Prior imaging unread"], "assignee": "Dr. Lena Morgan", "progress": "overdue", "mask_version": "System draft 01", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000071', 'AIS-240913-071', '12000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-071', '1.2.840.113619.2.55.071', now() - interval '5 hours', now() - interval '6 hours', 'Routine', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000031', '{"patient": "BN-2F08", "age": 49, "sex": "Male", "onset": "03:02", "received": "07:54", "sla": 35, "case_state": "AwaitingReview", "volume": 0, "side": "Undetermined", "territory": "-", "nihss": 4, "clusters": 0, "confidence": 0.41, "dice_score": 0, "threshold": 0.45, "missing_inputs": ["Empty mask - full manual read required"], "assignee": "Dr. Noah Williams", "progress": "waiting", "mask_version": "System draft 01", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000063', 'AIS-240913-063', '12000000-0000-0000-0000-000000000063', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-063', '1.2.840.113619.2.55.063', now() - interval '6 hours', now() - interval '7 hours', 'SignedOff', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000011', '{"patient": "BN-1E74", "age": 61, "sex": "Male", "volume": 12.4, "side": "Left hemisphere", "territory": "MCA", "nihss": 12, "case_state": "SignedOff", "disposition": "accepted_unchanged", "clinical_note": "Restricted diffusion in left MCA territory. No hemorrhage.", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000058', 'AIS-240913-058', '12000000-0000-0000-0000-000000000058', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-058', '1.2.840.113619.2.55.058', now() - interval '7 hours', now() - interval '8 hours', 'SignedOff', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000014', '{"patient": "BN-5B22", "age": 55, "sex": "Female", "volume": 6.8, "side": "Right hemisphere", "territory": "PCA", "nihss": 8, "case_state": "SignedOff", "disposition": "accepted_with_adjustment", "clinical_note": "Adjusted mask border near PCA territory; findings concordant.", "model_version": "v2.4.1"}'::jsonb),
    ('20000000-0000-0000-0000-000000000041', 'AIS-240913-041', '12000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ACC-240913-041', '1.2.840.113619.2.55.041', now() - interval '8 hours', now() - interval '9 hours', 'SignedOff', 'AIS', 'PASSED', '{"synthetic": true}'::jsonb, '00000000-0000-0000-0000-000000000011', '{"patient": "BN-9C04", "age": 70, "sex": "Female", "volume": 2.1, "side": "Left hemisphere", "territory": "ACA", "nihss": 5, "case_state": "SignedOff", "disposition": "accepted_unchanged", "clinical_note": "Small ACA territory lesion; clinical correlation advised.", "model_version": "v2.4.1"}'::jsonb)
ON CONFLICT (study_id) DO UPDATE SET
    status = EXCLUDED.status, clinical_data = EXCLUDED.clinical_data,
    assigned_user_id = EXCLUDED.assigned_user_id, qc_status = EXCLUDED.qc_status,
    updated_at = now();

-- DICOM metadata and storage objects for the viewer flow.
INSERT INTO series (series_id, study_id, series_instance_uid, modality, series_number, sequence_type, slice_thickness, file_count, metadata)
SELECT ('21000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id) * 10 + n)::text, 12, '0'))::uuid,
       s.study_id, '2.25.240913.' || replace(s.external_id, 'AIS-', '') || '.' || n,
       'MR', n, seq, 5.0, 42, '{"synthetic": true, "pixel_spacing": "1.0\\1.0"}'::jsonb
FROM study s
CROSS JOIN LATERAL (VALUES (1, 'DWI'), (2, 'ADC'), (3, 'FLAIR')) AS x(n, seq)
WHERE s.external_id LIKE 'AIS-240913-%'
ON CONFLICT (series_id) DO UPDATE SET metadata = EXCLUDED.metadata;

INSERT INTO storage_object (series_id, bucket, object_key, file_size, file_hash, mime_type, location)
SELECT se.series_id, 'uda-demo', 'synthetic/' || s.external_id || '/' || se.sequence_type || '.nii.gz',
       1048576, md5(se.series_id::text), 'application/gzip', '{"provider": "local-demo", "synthetic": true}'::jsonb
FROM series se JOIN study s ON s.study_id = se.study_id
WHERE s.external_id LIKE 'AIS-240913-%'
ON CONFLICT (object_key) DO UPDATE SET location = EXCLUDED.location;

INSERT INTO model (model_id, model_name, model_description, vendor)
VALUES ('30000000-0000-0000-0000-000000000001', 'UDA-StrokeSeg', 'Synthetic acute ischemic stroke lesion segmentation model', 'UDA AI Lab')
ON CONFLICT (model_id) DO UPDATE SET model_description = EXCLUDED.model_description;

INSERT INTO model_version (version_id, model_id, version_tag, architecture, input_modalities, hyperparameters, deployment_status, deployed_at)
VALUES
 ('31000000-0000-0000-0000-000000000241', '30000000-0000-0000-0000-000000000001', 'v2.4.1', 'nnU-Net 3D', '["DWI", "ADC", "FLAIR"]'::jsonb, '{"threshold": 0.45, "synthetic": true}'::jsonb, 'DEPLOYED', now() - interval '14 days'),
 ('31000000-0000-0000-0000-000000000250', '30000000-0000-0000-0000-000000000001', 'v2.5.0', 'nnU-Net 3D', '["DWI", "ADC", "FLAIR"]'::jsonb, '{"threshold": 0.42, "synthetic": true}'::jsonb, 'PENDING_CLINICAL_GATE', NULL)
ON CONFLICT (version_id) DO UPDATE SET deployment_status = EXCLUDED.deployment_status, hyperparameters = EXCLUDED.hyperparameters;

INSERT INTO inference_task (task_id, study_id, version_id, status, execution_queue, started_at, completed_at, output_metadata)
SELECT ('32000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id))::text, 12, '0'))::uuid,
       s.study_id, '31000000-0000-0000-0000-000000000241',
       CASE WHEN s.status = 'SignedOff' THEN 'COMPLETED' ELSE 'COMPLETED' END,
       'demo-ai-queue', now() - interval '2 hours', now() - interval '90 minutes',
       jsonb_build_object('confidence', s.clinical_data->'confidence', 'synthetic', true)
FROM study s
WHERE s.external_id LIKE 'AIS-240913-%'
ON CONFLICT (task_id) DO UPDATE SET status = EXCLUDED.status, output_metadata = EXCLUDED.output_metadata;

INSERT INTO segmentation_mask (mask_id, study_id, task_id, mask_type, version_no, object_key, approval_status, dice_score, created_by)
SELECT ('33000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id))::text, 12, '0'))::uuid,
       s.study_id,
       ('32000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id))::text, 12, '0'))::uuid,
       'AI_DRAFT', 1, 'synthetic/' || s.external_id || '/mask-v1.nii.gz',
       CASE WHEN s.status = 'SignedOff' THEN 'APPROVED' ELSE 'DRAFT' END,
       COALESCE((s.clinical_data->>'dice_score')::numeric, 0), '00000000-0000-0000-0000-000000000011'
FROM study s
WHERE s.external_id LIKE 'AIS-240913-%'
ON CONFLICT (mask_id) DO UPDATE SET approval_status = EXCLUDED.approval_status, dice_score = EXCLUDED.dice_score;

INSERT INTO lesion_measurement (measurement_id, mask_id, lesion_volume, diameter, surface_area, cluster_count, laterality, vascular_territory, position)
SELECT ('34000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id))::text, 12, '0'))::uuid,
       m.mask_id, COALESCE((s.clinical_data->>'volume')::numeric, 0), 22.4, 145.0,
       COALESCE((s.clinical_data->>'clusters')::integer, 0), s.clinical_data->>'side',
       s.clinical_data->>'territory', '{"slice": 14, "x": 0.48, "y": 0.52}'::jsonb
FROM segmentation_mask m JOIN study s ON s.study_id = m.study_id
WHERE m.mask_type = 'AI_DRAFT'
ON CONFLICT (measurement_id) DO UPDATE SET lesion_volume = EXCLUDED.lesion_volume, cluster_count = EXCLUDED.cluster_count;

INSERT INTO domain_adaptation_run (external_id, source_model_version_id, target_model_version_id, method, baseline_target_dice, adapted_target_dice, validation_metrics, adapted, created_by)
VALUES ('DAR-DEMO-001', '31000000-0000-0000-0000-000000000241', '31000000-0000-0000-0000-000000000250', 'Synthetic site calibration', 0.71, 0.84, '{"hausdorff95": 4.2, "samples": 24, "synthetic": true}'::jsonb, true, '00000000-0000-0000-0000-000000000008')
ON CONFLICT (external_id) DO UPDATE SET validation_metrics = EXCLUDED.validation_metrics, adapted = EXCLUDED.adapted;

INSERT INTO reason (reason_code, reason_type, description)
VALUES ('MISSING_FLAIR', 'QC', 'Mandatory FLAIR sequence is missing'), ('SLA_TIMEOUT', 'OPS', 'Automated analysis exceeded the demo SLA')
ON CONFLICT (reason_code) DO NOTHING;

INSERT INTO quarantine_log (quarantine_id, study_id, reason_code, details)
VALUES
 ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000071', 'MISSING_FLAIR', '{"ae_title": "ER_MRI_02", "dicom_status": "0xC000", "synthetic": true}'::jsonb),
 ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000079', 'SLA_TIMEOUT', '{"ae_title": "worker_ai_02", "dicom_status": "SLA_TIMEOUT", "synthetic": true}'::jsonb)
ON CONFLICT (quarantine_id) DO UPDATE SET details = EXCLUDED.details;

INSERT INTO report (report_id, study_id, report_version, status, content, generated_at, signed_by, signed_at, pdf_object_key)
SELECT ('41000000-0000-0000-0000-' || lpad((row_number() over (ORDER BY s.external_id))::text, 12, '0'))::uuid,
       s.study_id, 1, 'SIGNED',
       jsonb_build_object('impression', s.clinical_data->>'clinical_note', 'synthetic', true, 'patient_ref', p.external_patient_ref),
       now() - interval '30 minutes', '00000000-0000-0000-0000-000000000011', now() - interval '20 minutes',
       'synthetic/' || s.external_id || '/report-v1.pdf'
FROM study s JOIN patient p ON p.patient_id = s.patient_id
WHERE s.status = 'SignedOff'
ON CONFLICT (report_id) DO UPDATE SET status = EXCLUDED.status, content = EXCLUDED.content, signed_at = EXCLUDED.signed_at;

INSERT INTO clinical_feedback (feedback_id, study_id, author_id, agreement_with_ai, clinical_utility_rating, treatment_decision, comments)
VALUES ('42000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000024', true, 5, 'Continue stroke pathway', 'Synthetic feedback for physician demo flow.')
ON CONFLICT (feedback_id) DO UPDATE SET comments = EXCLUDED.comments, clinical_utility_rating = EXCLUDED.clinical_utility_rating;

INSERT INTO consultation_session (consultation_id, external_id, study_id, requested_by, lead_chair_id, status, trigger_reason, consensus_notes, digital_signature, started_at, ended_at)
VALUES
 ('50000000-0000-0000-0000-000000000018', 'CON-0913-018', '20000000-0000-0000-0000-000000000084', '00000000-0000-0000-0000-000000000011', NULL, 'PENDING_ASSIGNMENT', 'Acute complex MCA stroke - multidisciplinary review requested', NULL, NULL, NULL, NULL),
 ('50000000-0000-0000-0000-000000000012', 'CON-0913-012', '20000000-0000-0000-0000-000000000058', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'WAITING', 'Clinical-imaging mismatch, high hemorrhagic transformation risk', NULL, NULL, NULL, NULL),
 ('50000000-0000-0000-0000-000000000009', 'CON-0913-009', '20000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'FINALIZED', 'Wide lesion - panel consensus requested', 'Panel agrees with adjusted findings.', 'sig-v1:seed', now() - interval '2 hours', now() - interval '90 minutes')
ON CONFLICT (consultation_id) DO UPDATE SET status = EXCLUDED.status, lead_chair_id = EXCLUDED.lead_chair_id, consensus_notes = EXCLUDED.consensus_notes;

INSERT INTO consultation_member (consultation_id, user_id, external_user_id, member_metadata, role_in_session)
VALUES
 ('50000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000011', 'u-rad-011', '{"username": "lena.morgan", "role_in_session": "Requester", "presence": "INVITED"}'::jsonb, 'REQUESTER'),
 ('50000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', 'u-hod-003', '{"username": "thomas.nguyen", "role_in_session": "Chair", "presence": "INVITED"}'::jsonb, 'CHAIR'),
 ('50000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000011', 'u-rad-011', '{"username": "lena.morgan", "role_in_session": "Member", "presence": "INVITED"}'::jsonb, 'MEMBER'),
 ('50000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000024', 'u-phy-024', '{"username": "maya.harris", "role_in_session": "Member", "presence": "INVITED"}'::jsonb, 'MEMBER'),
 ('50000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000014', 'u-rad-014', '{"username": "priya.shah", "role_in_session": "Member", "presence": "INVITED"}'::jsonb, 'MEMBER')
ON CONFLICT (consultation_id, external_user_id) DO UPDATE SET member_metadata = EXCLUDED.member_metadata;

-- The DBML has a 1:1 consultation minutes entity. The normalized schema used
-- consultation_artifact for this purpose; retain the explicit table too so a
-- SQL client can query the DBML-shaped artifact without adapter assumptions.
CREATE TABLE IF NOT EXISTS consultation_minutes (
    minutes_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id uuid NOT NULL UNIQUE REFERENCES consultation_session(consultation_id) ON DELETE CASCADE,
    scope varchar(80), mode varchar(80), scheduled_at timestamptz, location text,
    consultation_request text, recipient_unit varchar(160), hospital_rep_opinion text
);

INSERT INTO consultation_minutes (minutes_id, consultation_id, scope, mode, scheduled_at, location, consultation_request, recipient_unit, hospital_rep_opinion)
VALUES ('51000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000009', 'Stroke panel', 'In-person', now() - interval '3 hours', 'Neuro conference room', 'Review wide ACA lesion', 'Stroke Medicine', 'Consensus supports adjusted mask')
ON CONFLICT (minutes_id) DO UPDATE SET hospital_rep_opinion = EXCLUDED.hospital_rep_opinion;

INSERT INTO audit_log (log_id, study_id, user_id, action, created_at, device, ip_address, payload_snapshot)
VALUES
 ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000011', 'SIGN_OFF', now() - interval '45 minutes', 'demo-browser', '127.0.0.1', '{"result": "OK", "synthetic": true}'::jsonb),
 ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000079', '00000000-0000-0000-0000-000000000008', 'SLA_TIMEOUT', now() - interval '25 minutes', 'worker_ai_02', '127.0.0.1', '{"result": "FAILED", "synthetic": true}'::jsonb)
ON CONFLICT (log_id) DO UPDATE SET payload_snapshot = EXCLUDED.payload_snapshot;

COMMIT;
