-- Additive migration. Apply using the project's dedicated database account.
CREATE TABLE IF NOT EXISTS facebook_settings (
    id TINYINT UNSIGNED PRIMARY KEY,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    rules_json TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source ENUM('manual','facebook') NOT NULL,
    external_id VARCHAR(190) NULL,
    kind ENUM('message','comment','lead') NOT NULL,
    guest_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    status ENUM('new','in_progress','resolved','converted') NOT NULL DEFAULT 'new',
    needs_attention TINYINT(1) NOT NULL DEFAULT 0,
    booking_id BIGINT UNSIGNED NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY facebook_event_external (kind, external_id),
    INDEX facebook_event_inbox (kind, status, id),
    CONSTRAINT facebook_event_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_drafts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('pending','approved','rejected','published') NOT NULL DEFAULT 'pending',
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    approved_by BIGINT UNSIGNED NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT UNSIGNED NULL,
    kind ENUM('reply','publish') NOT NULL,
    dedupe_key VARCHAR(190) NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    status ENUM('blocked','pending','processing','retry_wait','succeeded','failed','cancelled') NOT NULL DEFAULT 'blocked',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMP NULL,
    error_code VARCHAR(50) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX facebook_jobs_due (status, next_attempt_at),
    CONSTRAINT facebook_job_event FOREIGN KEY (event_id) REFERENCES facebook_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX facebook_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
