-- Stateful, rules-based Messenger booking conversations.
CREATE TABLE IF NOT EXISTS facebook_conversations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    page_id VARCHAR(64) NOT NULL,
    sender_id VARCHAR(64) NOT NULL,
    state VARCHAR(40) NOT NULL DEFAULT 'idle',
    data_json TEXT NOT NULL,
    booking_id BIGINT UNSIGNED NULL,
    last_event_id BIGINT UNSIGNED NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY facebook_conversation_sender (page_id, sender_id),
    INDEX facebook_conversation_state (state, updated_at),
    CONSTRAINT facebook_conversation_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT facebook_conversation_event FOREIGN KEY (last_event_id) REFERENCES facebook_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
