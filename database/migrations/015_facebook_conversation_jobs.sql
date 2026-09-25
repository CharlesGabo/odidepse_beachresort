-- Additive: apply before deploying the conversation worker.
ALTER TABLE facebook_jobs
    MODIFY COLUMN kind ENUM('reply','publish','lead_fetch','profile_fetch','conversation') NOT NULL;
