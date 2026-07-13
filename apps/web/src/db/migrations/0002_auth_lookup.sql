-- NextAuth's Credentials `authorize()` callback must look up a user by email
-- BEFORE any session exists, so app.current_user_id is unset. Under
-- users_select_self / users_select_collaborators alone, that lookup would
-- return zero rows via the RLS-protected app_user connection, breaking login
-- entirely. Same shape as is_document_member in 0001: a narrow,
-- SECURITY DEFINER function that only ever answers one pre-authorization
-- question (does this email exist, and if so what's its id/hash), not a
-- general-purpose RLS bypass.
CREATE OR REPLACE FUNCTION auth_lookup_user(p_email text)
RETURNS TABLE (id uuid, password_hash text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET row_security = off AS $$
	SELECT id, password_hash, name FROM users WHERE email = p_email
$$;

-- Same pre-authorization shape as auth_lookup_user, for a different
-- caller: inviting a collaborator by email needs to resolve that email to
-- a user id before any document_members row (and thus users_select_
-- collaborators visibility) exists between the two users. Deliberately
-- excludes password_hash — this one's exposed to a plain API response, not
-- just used internally for a bcrypt.compare.
CREATE OR REPLACE FUNCTION find_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET row_security = off AS $$
	SELECT id, email, name FROM users WHERE email = p_email
$$;

DO $$
BEGIN
	IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
		GRANT EXECUTE ON FUNCTION auth_lookup_user(text) TO app_user;
		GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO app_user;
	ELSE
		RAISE NOTICE 'Role "app_user" does not exist yet - skipping GRANT. See 0001_rls_policies.sql.';
	END IF;
END
$$;
