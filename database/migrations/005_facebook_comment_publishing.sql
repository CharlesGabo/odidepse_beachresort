-- Additive migration for installations that already applied migration 004.
ALTER TABLE facebook_events
    ADD COLUMN website_status ENUM('hidden','published') NOT NULL DEFAULT 'hidden' AFTER needs_attention,
    ADD COLUMN website_published_at TIMESTAMP NULL AFTER website_status,
    ADD INDEX facebook_event_website (kind, website_status, website_published_at);
