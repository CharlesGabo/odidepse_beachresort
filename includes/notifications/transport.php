<?php
declare(strict_types=1);
require_once __DIR__ . '/notifications.php';

function notificationReadiness(): array
{
    $missing = [];
    foreach (['MAIL_HOST','MAIL_USERNAME','MAIL_PASSWORD','MAIL_FROM_ADDRESS','MAIL_ADMIN_RECIPIENTS','APP_BASE_URL'] as $name) {
        if (!getenv($name)) $missing[] = $name;
    }
    if (getenv('MAIL_FROM_ADDRESS') && !notificationAddress((string) getenv('MAIL_FROM_ADDRESS'))) $missing[] = 'Valid MAIL_FROM_ADDRESS';
    if (getenv('MAIL_REPLY_TO_ADDRESS') && !notificationAddress((string) getenv('MAIL_REPLY_TO_ADDRESS'))) $missing[] = 'Valid MAIL_REPLY_TO_ADDRESS';
    if (getenv('MAIL_TEST_RECIPIENT') && !notificationAddress((string) getenv('MAIL_TEST_RECIPIENT'))) $missing[] = 'Valid MAIL_TEST_RECIPIENT';
    if (!in_array(getenv('MAIL_ENCRYPTION') ?: 'tls', ['tls','ssl'], true)) $missing[] = 'MAIL_ENCRYPTION (tls or ssl)';
    if (!filter_var(getenv('MAIL_PORT') ?: '587', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]])) $missing[] = 'Valid MAIL_PORT';
    if (getenv('APP_BASE_URL') && !notificationSafeUrl((string) getenv('APP_BASE_URL'))) $missing[] = 'HTTPS APP_BASE_URL';
    if (!is_file(dirname(__DIR__, 2) . '/vendor/autoload.php')) $missing[] = 'Composer dependencies';
    if (getenv('MAIL_HOST') === 'smtp.gmail.com' && strtolower((string) getenv('MAIL_USERNAME')) !== strtolower((string) getenv('MAIL_FROM_ADDRESS'))) $missing[] = 'Gmail From must match username';
    try { notificationAdminRecipients(true); } catch (InvalidArgumentException) { $missing[] = 'Valid MAIL_ADMIN_RECIPIENTS'; }
    return ['enabled' => notificationEnabled(), 'ready' => $missing === [], 'missing' => $missing, 'test_mode' => (bool) getenv('MAIL_TEST_RECIPIENT')];
}

function notificationSmtpSend(array $job): array
{
    require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
    require_once __DIR__ . '/templates.php';
    static $mail = null;
    static $smtp = null;
    if (!$mail instanceof \PHPMailer\PHPMailer\PHPMailer || !$smtp instanceof \PHPMailer\PHPMailer\SMTP) {
        // A timeout after DATA may mean the provider already accepted the message.
        $smtp = new class extends \PHPMailer\PHPMailer\SMTP {
            public bool $dataStarted = false;
            public bool $dataAccepted = false;
            public function data($msg_data) {
                $this->dataStarted = true;
                $result = parent::data($msg_data);
                $this->dataAccepted = $result;
                return $result;
            }
        };
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->setSMTPInstance($smtp);
        $mail->isSMTP();
        $mail->Host = (string) getenv('MAIL_HOST');
        $mail->Port = (int) (getenv('MAIL_PORT') ?: 587);
        $mail->SMTPAuth = true;
        $mail->Username = (string) getenv('MAIL_USERNAME');
        $mail->Password = (string) getenv('MAIL_PASSWORD');
        $mail->SMTPSecure = getenv('MAIL_ENCRYPTION') ?: 'tls';
        $mail->SMTPDebug = 0;
        $mail->Timeout = 8;
        $mail->SMTPKeepAlive = true;
        $smtp->Timelimit = 12;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom((string) getenv('MAIL_FROM_ADDRESS'), getenv('MAIL_FROM_NAME') ?: 'Odidepse Beach Resort');
        $mail->addReplyTo(getenv('MAIL_REPLY_TO_ADDRESS') ?: (string) getenv('MAIL_FROM_ADDRESS'));
    }
    $recipient = getenv('MAIL_TEST_RECIPIENT') ?: $job['recipient'];
    if (!notificationAddress($recipient)) return ['status' => 'failed', 'code' => 'invalid_recipient'];
    $mail->clearAllRecipients();
    $smtp->dataStarted = false;
    $smtp->dataAccepted = false;
    $mail->addAddress($recipient);
    $payload = json_decode($job['payload_json'], true, 32, JSON_THROW_ON_ERROR);
    $render = notificationRender($job['event_type'], $payload);
    $mail->Subject = $job['subject'];
    $mail->isHTML(true); $mail->Body = $render['html']; $mail->AltBody = $render['text'];
    $domain = substr((string) getenv('MAIL_FROM_ADDRESS'), strpos((string) getenv('MAIL_FROM_ADDRESS'), '@') + 1);
    $mail->MessageID = '<' . $job['dedupe_key'] . '@' . $domain . '>';
    try {
        $mail->send();
        return ['status' => 'succeeded', 'code' => null];
    } catch (Throwable) {
        $dataStarted = $smtp->dataStarted;
        $dataAccepted = $smtp->dataAccepted;
        $code = (int) ($smtp->getError()['smtp_code'] ?? 0);
        $mail->smtpClose();
        $mail = null;
        $smtp = null;
        if ($dataAccepted) return ['status' => 'succeeded', 'code' => null];
        if ($dataStarted && $code === 0) return ['status' => 'unknown', 'code' => 'delivery_unconfirmed'];
        if ($code >= 500) return ['status' => 'failed', 'code' => 'smtp_rejected'];
        return ['status' => 'retry_wait', 'code' => 'smtp_temporary_failure'];
    }
}
