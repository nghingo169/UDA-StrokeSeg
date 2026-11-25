# Local data services

Run these commands from the repository root (`Emergency Healthcare Dashboard Views`), not from `apps/server`:

```powershell
docker compose -f ops/docker/docker-compose.dev.yml up -d
```

If the API terminal is already in `apps/server`, first return to the root:

```powershell
cd ../..
```

PostgreSQL is available at `postgresql://uda:uda_dev_password@localhost:5432/uda_strokeseg`.
Kafka is available to local applications at `localhost:9092`; Kafka UI is at `http://localhost:8080`.
The Compose file uses Apache's official `apache/kafka:4.1.2` image. Its environment variables use the official `KAFKA_*` names rather than Bitnami's `KAFKA_CFG_*` names.

The PostgreSQL schema is initialized in order from `ops/docker/postgres/init/001_schema.sql` through `005_seed_demo_data.sql`. The final script creates the synthetic HRM directory, studies, DICOM metadata, AI tasks/masks/measurements, reports, consultations, audit events, and quarantine records used by the full-flow demo. All demo accounts use the password `Pass@123` through the API demo-auth adapter; passwords are not stored in PostgreSQL.

The init scripts only run when the database volume is first created. For a fresh demo database:

```powershell
docker compose -f ops/docker/docker-compose.dev.yml down -v
docker compose -f ops/docker/docker-compose.dev.yml up -d
```

If the volume already contains the schema, run the seed manually from the PostgreSQL container:

```powershell
docker compose -f ops/docker/docker-compose.dev.yml exec -T postgres psql -U uda -d uda_strokeseg < ops/docker/postgres/init/005_seed_demo_data.sql
```

Then start the API with `UDA_DEMO_MODE=false` to exercise the PostgreSQL-backed HRM lookup. The supported demo logins are `lena.morgan` (radiologist), `priya.shah` (radiologist), `maya.harris` (physician), `thomas.nguyen` (HoD), `alex.nguyen` (IT), and `noah.williams` (radiologist), all with password `Pass@123`.

Recommended Kafka event keys are the aggregate ID (`study_id`, `mask_id`, or `task_id`). Event payloads should contain `event_id`, `event_type`, `occurred_at`, `producer`, `schema_version`, and `data`; do not put DICOM pixels or credentials in Kafka.

Initial topics:

- `study.validated`
- `mask.revised`
- `inference.completed`
- `sla.timeout`
- `consultation.updated`

