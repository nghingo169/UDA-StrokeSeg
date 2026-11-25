-- Canonical identities for the relational User/Role part of the ERD.
INSERT INTO app_user (user_id, username, email, full_name, department, employee_id)
VALUES
 ('00000000-0000-0000-0000-000000000011', 'lena.morgan', 'lena.morgan@uda.local', 'Dr. Lena Morgan', 'Radiology', 'RAD-011'),
 ('00000000-0000-0000-0000-000000000014', 'priya.shah', 'priya.shah@uda.local', 'Dr. Priya Shah', 'Radiology', 'RAD-014'),
 ('00000000-0000-0000-0000-000000000024', 'maya.harris', 'maya.harris@uda.local', 'Dr. Maya Harris', 'Stroke Medicine', 'PHY-024'),
 ('00000000-0000-0000-0000-000000000003', 'thomas.nguyen', 'thomas.nguyen@uda.local', 'Dr. Thomas Nguyen', 'Neurology', 'HOD-003'),
 ('00000000-0000-0000-0000-000000000008', 'alex.nguyen', 'alex.nguyen@uda.local', 'Alex Nguyen', 'IT', 'IT-008')
ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username,
  email = EXCLUDED.email, full_name = EXCLUDED.full_name,
  department = EXCLUDED.department, employee_id = EXCLUDED.employee_id,
  is_active = true, updated_at = now();

INSERT INTO user_role(user_id, role_id)
SELECT u.user_id, r.role_id
FROM app_user u
JOIN role r ON r.role_name = CASE
  WHEN u.username IN ('lena.morgan', 'priya.shah') THEN 'radiologist'
  WHEN u.username = 'maya.harris' THEN 'physician'
  WHEN u.username = 'thomas.nguyen' THEN 'hod'
  ELSE 'it' END
ON CONFLICT DO NOTHING;
