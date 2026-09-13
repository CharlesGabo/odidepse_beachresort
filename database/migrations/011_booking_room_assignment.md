Room moves require `011_booking_room_assignment.sql` before the updated booking API is used.

Local setup: `C:\xampp\php\php.exe scripts\setup-booking-rooms.php`.
If the application's least-privilege account cannot alter tables, import the SQL file using the local phpMyAdmin administrator. Keep the application's database credentials unchanged.
This adds a nullable room index without deleting bookings. Existing assignments are calculated until the first room move or status change pins their positions. Accepted moves save accommodation and room while preserving dates and status.

The server validates capacity and active occupancy. Pending requests can overlap; confirming one leaves other requests untouched. Unknown boundary times are treated conservatively as overlapping. Completed bookings do not block rooms. Overlapping request groups are numbered by creation time, with booking ID breaking ties.
