-- Placeholder migration to restore migration history integrity.
-- The original `recipe_scaling` migration was missing from the repo; there is no matching
-- schema change in the current Prisma schema (no recipe scaling fields). Safe no-op.
-- If your database was manually altered for scaling, align this file with those changes.

SELECT 1;
