-- Consolidate legacy zb_bookings records into the current booking-management schema.
-- Back up the legacy tables before applying this destructive migration.

INSERT IGNORE INTO bookings (
    reference_code,
    guest_name,
    email,
    phone,
    check_in,
    check_out,
    guests,
    stay_type,
    message,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT('ZB-', LPAD(legacy.id, 6, '0')),
    LEFT(legacy.guest_name, 100),
    LEFT(legacy.guest_email, 190),
    LEFT(COALESCE(NULLIF(legacy.guest_phone, ''), 'Not provided'), 30),
    legacy.check_in,
    legacy.check_out,
    LEAST(GREATEST(COALESCE(legacy.adults, 0) + COALESCE(legacy.children, 0), 1), 8),
    CASE room.title
        WHEN 'Beachfront Villa' THEN 'Puno Villa'
        WHEN 'Ocean View Suite' THEN 'Dagat Casita'
        WHEN 'Garden Retreat' THEN 'Dagat Casita'
        ELSE NULL
    END,
    CONCAT('Migrated from legacy booking #', legacy.id, '.'),
    legacy.status,
    legacy.created_at,
    legacy.created_at
FROM zb_bookings AS legacy
LEFT JOIN zb_rooms AS room ON room.id = legacy.room_id;

DROP TABLE zb_bookings;
DROP TABLE zb_admins;
DROP TABLE zb_inquiries;
DROP TABLE zb_rooms;
