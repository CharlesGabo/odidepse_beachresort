CREATE TABLE IF NOT EXISTS resort_revision (
    id TINYINT UNSIGNED PRIMARY KEY,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO resort_revision (id, revision) VALUES (1, 1);

CREATE TABLE IF NOT EXISTS resort_content (
    section_key VARCHAR(80) PRIMARY KEY,
    content JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resort_stays (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    seed_key VARCHAR(80) NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    price DECIMAL(12,2) NULL,
    price_mode ENUM('fixed','from') NOT NULL DEFAULT 'fixed',
    price_unit VARCHAR(80) NOT NULL DEFAULT '',
    availability ENUM('available','unavailable','inquiry') NOT NULL DEFAULT 'inquiry',
    availability_text VARCHAR(300) NOT NULL DEFAULT '',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    details JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resort_services LIKE resort_stays;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stay_id BIGINT UNSIGNED NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id BIGINT UNSIGNED NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name VARCHAR(50) NULL;
