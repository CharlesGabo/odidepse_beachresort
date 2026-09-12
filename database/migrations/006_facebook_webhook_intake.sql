-- Page identity and delivery context for verified Meta webhook events.
ALTER TABLE facebook_events
    ADD COLUMN page_id VARCHAR(64) NULL AFTER external_id,
    ADD COLUMN sender_id VARCHAR(64) NULL AFTER page_id,
    ADD COLUMN last_customer_message_at TIMESTAMP NULL AFTER body,
    ADD INDEX facebook_event_sender (page_id, sender_id, kind, received_at);

ALTER TABLE facebook_jobs
    MODIFY COLUMN kind ENUM('reply','publish','lead_fetch') NOT NULL;
