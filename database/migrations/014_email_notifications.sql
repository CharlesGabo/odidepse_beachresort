-- Additive; 013 is reserved for the separate analytics branch.
CREATE TABLE IF NOT EXISTS notification_settings (
    id TINYINT UNSIGNED PRIMARY KEY,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    settings_json TEXT NOT NULL,
    worker_seen_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO notification_settings (id, settings_json) VALUES (1, '{}');

CREATE TABLE IF NOT EXISTS booking_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    event_key VARCHAR(190) NOT NULL UNIQUE,
    event_type VARCHAR(40) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    staff_note VARCHAR(1000) NOT NULL DEFAULT '',
    cancellation_reason VARCHAR(1000) NOT NULL DEFAULT '',
    metadata_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX booking_events_history (booking_id, id),
    CONSTRAINT notification_event_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dedupe_key CHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(60) NOT NULL,
    booking_id BIGINT UNSIGNED NULL,
    booking_event_id BIGINT UNSIGNED NULL,
    recipient VARCHAR(190) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    payload_json MEDIUMTEXT NOT NULL,
    status ENUM('pending','processing','retry_wait','succeeded','failed','unknown','cancelled','skipped') NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    manual_retries SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    error_code VARCHAR(60) NULL,
    next_attempt_at DATETIME NULL,
    started_at DATETIME NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX email_jobs_due (status, next_attempt_at, id),
    INDEX email_jobs_booking (booking_id, id),
    INDEX email_jobs_recipient (recipient, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
