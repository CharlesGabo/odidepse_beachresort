<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/auth.php';
requireMethod('POST');
requireAdmin();
requireCsrfToken();

// Server-only mode: reuse the public form's validation and insertion path.
define('ADMIN_MANUAL_BOOKING', true);
require dirname(__DIR__) . '/bookings.php';
