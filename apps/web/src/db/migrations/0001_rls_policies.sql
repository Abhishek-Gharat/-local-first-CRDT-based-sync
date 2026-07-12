-- Row-Level Security: tenant isolation keyed off app.current_user_id,
-- set per-transaction by withUserContext() (see src/db/with-user-context.ts).
-- FORCE ROW LEVEL SECURITY is required on every table here because the
-- migration role also owns these tables, and Postgres skips RLS for a
-- table's owner unless FORCE is set.
--
-- FORCE only closes the "owner" loophole, not the "superuser" one: Postgres
-- always lets superusers and BYPASSRLS roles skip RLS entirely, and the
-- role docker-compose provisions (POSTGRES_USER) is a superuser. So the app
-- must never connect to Postgres as that role at runtime — it's for running
-- migrations only. The runtime app connects as `app_user` (created by
-- docker/init-app-role.sh locally; create the equivalent non-superuser role
-- by hand on a hosted provider), which is what's actually subject to every
-- policy below. See APP_DATABASE_URL vs DATABASE_URL in .env.example.

-- Returns the current request's user id, or null outside any tenant context
-- (e.g. a raw superuser session), from which every policy below derives.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
	SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

-- Membership check used by policies on documents/document_versions.
-- SECURITY DEFINER + row_security = off: document_members itself has RLS,
-- so a normal (invoker-rights) function here would recurse into its own
-- policy while checking membership. Running as definer with row_security
-- off breaks that cycle; the function still only ever answers "is this one
-- (document_id, user_id) pair a member," so it can't be used to leak rows.
CREATE OR REPLACE FUNCTION is_document_member(p_document_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET row_security = off AS $$
	SELECT EXISTS (
		SELECT 1 FROM document_members
		WHERE document_id = p_document_id AND user_id = p_user_id
	)
$$;

-- users ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- can always see your own row
CREATE POLICY users_select_self ON users FOR SELECT
	USING (id = app_current_user_id());

-- can see the profile of anyone you share a document with (needed to show
-- collaborator names/emails in the UI)
CREATE POLICY users_select_collaborators ON users FOR SELECT
	USING (
		EXISTS (
			SELECT 1 FROM document_members me
			JOIN document_members them ON them.document_id = me.document_id
			WHERE me.user_id = app_current_user_id() AND them.user_id = users.id
		)
	);

-- signup happens before any session context exists, so insert is open;
-- the row itself still requires a unique email and a hashed password
CREATE POLICY users_insert_self ON users FOR INSERT
	WITH CHECK (true);

-- documents --------------------------------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY documents_select_members ON documents FOR SELECT
	USING (is_document_member(id, app_current_user_id()));

CREATE POLICY documents_insert_owner ON documents FOR INSERT
	WITH CHECK (owner_id = app_current_user_id());

CREATE POLICY documents_update_members ON documents FOR UPDATE
	USING (is_document_member(id, app_current_user_id()))
	WITH CHECK (is_document_member(id, app_current_user_id()));

CREATE POLICY documents_delete_owner ON documents FOR DELETE
	USING (owner_id = app_current_user_id());

-- document_members --------------------------------------------------------
ALTER TABLE document_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_members FORCE ROW LEVEL SECURITY;

-- any member of a document can see the rest of its member list
CREATE POLICY document_members_select ON document_members FOR SELECT
	USING (is_document_member(document_id, app_current_user_id()));

-- only the document's owner can add/change/remove members (invite, change
-- role, revoke access)
CREATE POLICY document_members_write_owner ON document_members FOR ALL
	USING (
		EXISTS (
			SELECT 1 FROM documents
			WHERE documents.id = document_members.document_id
				AND documents.owner_id = app_current_user_id()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM documents
			WHERE documents.id = document_members.document_id
				AND documents.owner_id = app_current_user_id()
		)
	);

-- document_versions -------------------------------------------------------
-- append-only: select + insert policies only, no update/delete policy is
-- ever granted, so no role (however privileged in the app) can rewrite or
-- erase a past version through this connection.
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY document_versions_select ON document_versions FOR SELECT
	USING (is_document_member(document_id, app_current_user_id()));

CREATE POLICY document_versions_insert ON document_versions FOR INSERT
	WITH CHECK (is_document_member(document_id, app_current_user_id()));

-- app_user privileges ------------------------------------------------------
-- Table-level GRANTs are necessary but not sufficient on their own — RLS
-- still applies on top. E.g. DELETE is granted on document_versions here
-- for simplicity, but since no DELETE policy exists for that table, RLS
-- silently matches zero rows for that command regardless of this GRANT.
-- The row-level policies above are the actual enforcement; this block just
-- lets app_user reach the tables and functions at all.
DO $$
BEGIN
	IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
		GRANT USAGE ON SCHEMA public TO app_user;
		GRANT SELECT, INSERT, UPDATE, DELETE ON users, documents, document_members, document_versions TO app_user;
		GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_user;
		GRANT EXECUTE ON FUNCTION is_document_member(uuid, uuid) TO app_user;
	ELSE
		RAISE NOTICE 'Role "app_user" does not exist yet - skipping GRANTs. Create a non-superuser LOGIN role named app_user (see docker/init-app-role.sh for local dev), then re-run these GRANT statements before pointing the app at this database.';
	END IF;
END
$$;