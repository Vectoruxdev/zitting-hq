-- =============================================================
-- Zitting Finance — link the owner's login to his roster row.
-- One-off data fix (idempotent). Run in Supabase → SQL Editor.
--
-- The owner Jared signs in with jared@vectorux.com but the "Jared" family_members
-- row was tag-only (no email), so getCurrentUser() couldn't match them and
-- returned memberId = null. That left `categorized_by` null on his manual
-- categorizations (no "Categorized by" tag). Setting the email links the login
-- to the roster row. Email is stored lowercase to match getCurrentUser().
-- =============================================================

UPDATE family_members
SET email = 'jared@vectorux.com'
WHERE role = 'owner'
  AND name = 'Jared'
  AND (email IS NULL OR email = '');
