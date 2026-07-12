#!/bin/sh
# Runs once, on first container startup, before anything else connects.
# POSTGRES_USER (superuser) always bypasses RLS, so the app can't run as
# that role — this creates the restricted, non-superuser role the running
# app actually connects as (see APP_DATABASE_URL in .env.example and the
# comment at the top of src/db/migrations/0001_rls_policies.sql).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
		IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
			CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}';
		END IF;
	END
	\$\$;
	GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};
EOSQL
