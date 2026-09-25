-- Additive and repeatable. Compatible with the earlier local analytics schema.
ALTER TABLE bookings
 ADD COLUMN IF NOT EXISTS agreed_total DECIMAL(12,2) NULL,
 ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'PHP',
 ADD COLUMN IF NOT EXISTS finance_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS booking_source ENUM('website','website_chat','facebook','manual','unknown') NOT NULL DEFAULT 'unknown',
 ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(12,2) NULL,
 ADD COLUMN IF NOT EXISTS estimate_basis VARCHAR(1000) NULL,
 ADD COLUMN IF NOT EXISTS estimate_recorded_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS booking_payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id BIGINT UNSIGNED NOT NULL,
 kind ENUM('payment','refund') NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 paid_on DATE NOT NULL,
 method ENUM('cash','gcash','bank_transfer','card','other') NOT NULL,
 reference VARCHAR(100) NOT NULL DEFAULT '', note VARCHAR(500) NOT NULL DEFAULT '',
 created_by BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 voided_by BIGINT UNSIGNED NULL, voided_at TIMESTAMP NULL DEFAULT NULL, void_reason VARCHAR(500) NULL,
 INDEX (booking_id,paid_on), INDEX (paid_on,voided_at),
 FOREIGN KEY (booking_id) REFERENCES bookings(id), CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_finance_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, booking_id BIGINT UNSIGNED NOT NULL,
 old_total DECIMAL(12,2) NULL, new_total DECIMAL(12,2) NOT NULL, reason VARCHAR(500) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX (booking_id,created_at), FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_activity_requests (
 booking_id BIGINT UNSIGNED NOT NULL, service_id BIGINT UNSIGNED NOT NULL,
 service_name VARCHAR(50) NOT NULL,
 PRIMARY KEY (booking_id,service_id), FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
