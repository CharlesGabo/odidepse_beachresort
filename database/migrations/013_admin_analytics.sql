ALTER TABLE bookings
    ADD COLUMN agreed_total DECIMAL(12,2) NULL,
    ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'PHP',
    ADD COLUMN finance_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN booking_source ENUM('website','website_chat','facebook','manual','unknown') NOT NULL DEFAULT 'unknown',
    ADD INDEX idx_analytics_stay_dates (stay_id, check_in, check_out),
    ADD INDEX idx_analytics_source_created (booking_source, created_at);

CREATE TABLE IF NOT EXISTS booking_finance_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    old_total DECIMAL(12,2) NULL,
    new_total DECIMAL(12,2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (booking_id, created_at),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('payment','refund') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_on DATE NOT NULL,
    method ENUM('cash','gcash','bank_transfer','card','other') NOT NULL,
    reference VARCHAR(100) NOT NULL DEFAULT '',
    note VARCHAR(500) NOT NULL DEFAULT '',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    voided_by BIGINT UNSIGNED NULL,
    voided_at TIMESTAMP NULL DEFAULT NULL,
    void_reason VARCHAR(500) NULL,
    INDEX (booking_id, paid_on),
    INDEX (paid_on, voided_at),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (booking_id, created_at),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_cache (
    cache_key CHAR(64) PRIMARY KEY,
    payload MEDIUMTEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_ai_limits (
    actor_id BIGINT UNSIGNED PRIMARY KEY,
    window_start DATETIME NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE bookings b SET booking_source = 'facebook'
WHERE booking_source = 'unknown' AND EXISTS (
    SELECT 1 FROM facebook_events e WHERE e.booking_id = b.id AND e.source = 'facebook'
);
-- The token-derived reference is server-generated; free-text notes alone are not proof of source.
UPDATE bookings SET booking_source = 'website_chat'
WHERE booking_source = 'unknown' AND reference_code REGEXP '^OD-W-[A-F0-9]{18}$';
