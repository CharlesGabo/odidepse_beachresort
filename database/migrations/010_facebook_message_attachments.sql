-- Preserve verified Meta message attachments for the authenticated admin inbox.
ALTER TABLE facebook_events
    ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(20) NULL AFTER body,
    ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL AFTER attachment_type,
    ADD COLUMN IF NOT EXISTS attachments_json TEXT NULL AFTER attachment_url;
