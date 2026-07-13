-- documents_select_members previously only granted visibility via an
-- existing document_members row. That makes `INSERT INTO documents ...
-- RETURNING` fail RLS for a brand-new document: Postgres checks the
-- SELECT policy against the just-inserted row when RETURNING is present,
-- and the owner's own membership row doesn't exist yet at that point
-- (it's inserted in a second statement, same transaction, right after).
-- Fix: let the owner see their own document directly via owner_id, same
-- pattern already used by documents_insert_owner/documents_delete_owner,
-- in addition to the existing membership-based visibility for
-- editors/viewers.
ALTER POLICY documents_select_members ON documents
	USING (owner_id = app_current_user_id() OR is_document_member(id, app_current_user_id()));
