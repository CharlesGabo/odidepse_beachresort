-- Records successful Meta callback verification for the admin connection indicator.
CREATE TABLE IF NOT EXISTS facebook_webhook_state (
    id TINYINT UNSIGNED PRIMARY KEY,
    verified_host VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
