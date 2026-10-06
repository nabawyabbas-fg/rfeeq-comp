-- The two fields the Rfeeq account-completion step collects.
--
-- birthYear serves الجودة الدعوية — the brief asks that an answer take the
-- reader's background and level into account — and is deliberately the least
-- that can: a year, not a date, not an age, nothing derived.
--
-- consentAt records acceptance of the terms and the privacy policy. A timestamp
-- rather than a boolean, because الخصوصية requires a *stated* policy and
-- "they agreed" means little without which policy was in force when.
--
-- Both nullable: every account that exists predates this step, and none of them
-- should be treated as having answered.
ALTER TABLE "user" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "user" ADD COLUMN "consentAt" TIMESTAMP(3);
