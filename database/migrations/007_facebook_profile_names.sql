-- Resolve Messenger sender display names asynchronously without delaying webhook acknowledgement.
ALTER TABLE facebook_jobs
    MODIFY COLUMN kind ENUM('reply','publish','lead_fetch','profile_fetch') NOT NULL;
