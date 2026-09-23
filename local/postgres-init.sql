-- Runs once, on first boot only (docker-entrypoint-initdb.d). Mirrors
-- chart/templates/postgres.yaml's init ConfigMap: one Postgres role, two
-- databases (hydra, kratos).
CREATE DATABASE kratos OWNER hydra;
