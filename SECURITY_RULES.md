# Web Application Security Development Rules

## 1. Core Development Rule

**Security must be implemented hand in hand with functionality.**

Do not build the entire web system first and add security afterward. Every feature must be developed with its relevant security controls from the beginning.

### Development principle

```text
Build Feature
      ↓
Implement Security Controls
      ↓
Test Functionality
      ↓
Test Security
      ↓
Move to Next Feature
```

Security hardening and security testing can be performed again after the entire system is functional.

---

# 2. Security Development Order

## Phase 1 — Secure Foundation

Before developing major system features, establish the basic security architecture.

* [ ] HTTPS / SSL/TLS
* [ ] Environment variable configuration
* [ ] Secure `.env` handling
* [ ] Secure database connection
* [ ] Database least-privilege account
* [ ] Secure session configuration
* [ ] Secure cookie configuration
* [ ] Production error handling
* [ ] Security headers
* [ ] Basic logging structure

---

# 3. Authentication Security

Authentication must be secured before implementing features that require user accounts.

* [ ] Password hashing using a strong password-hashing algorithm
* [ ] Password verification
* [ ] Secure login system
* [ ] Secure logout
* [ ] Session ID regeneration after authentication
* [ ] Session timeout
* [ ] Session invalidation after logout
* [ ] Secure session cookies
* [ ] Brute-force protection
* [ ] Login rate limiting
* [ ] Account lockout or authentication throttling
* [ ] Secure password reset
* [ ] Expiring password-reset tokens
* [ ] Email verification
* [ ] Multi-Factor Authentication (MFA), where appropriate

### Authentication rule

Never store plaintext passwords.

Use PHP's password hashing functions instead of creating a custom password-hashing system.

---

# 4. Authorization Security

Authentication determines **who the user is**. Authorization determines **what the user is allowed to do**.

Implement authorization for every protected resource and action.

* [ ] Role-Based Access Control (RBAC)
* [ ] Permission checks
* [ ] Resource ownership checks
* [ ] Least-privilege access
* [ ] Server-side authorization checks
* [ ] Protection against direct URL access
* [ ] Protection against unauthorized API requests

### Authorization rule

Never rely on JavaScript or hidden UI elements for security.

For example, hiding an administrator button does not prevent a user from directly sending the administrator request.

Every sensitive action must be checked by the PHP backend.

```text
Request
   ↓
Authenticated?
   ↓
Authorized?
   ↓
Valid request?
   ↓
Perform action
```

---

# 5. Input Security

Treat all user-provided data as untrusted.

This includes:

* Form inputs
* URL parameters
* Query parameters
* POST data
* JSON requests
* Cookies
* HTTP headers
* Uploaded files
* API requests

Implement:

* [ ] Input validation
* [ ] Data type validation
* [ ] Length validation
* [ ] Range validation
* [ ] Required-field validation
* [ ] Allowed-value validation
* [ ] Server-side validation
* [ ] Client-side validation for usability

### Input validation rule

Client-side JavaScript validation must **never replace server-side validation**.

Users can bypass JavaScript completely, so PHP must validate all important input.

---

# 6. SQL Injection Protection

All database operations must use safe database practices.

* [ ] Prepared SQL statements
* [ ] Parameterized queries
* [ ] PDO or MySQLi with prepared statements
* [ ] Database least-privilege accounts
* [ ] No direct insertion of user input into SQL queries

### Never do this

```php
$sql = "SELECT * FROM users WHERE id = $id";
```

### Use parameterized queries

```php
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$id]);
```

### SQL security rule

**Never trust user input inside SQL queries.**

---

# 7. XSS Protection

Protect the application against Cross-Site Scripting (XSS).

* [ ] Output encoding
* [ ] HTML escaping
* [ ] Safe handling of user-generated content
* [ ] Content Security Policy (CSP), where appropriate
* [ ] Avoid unsafe HTML rendering
* [ ] Validate rich-text content if the system allows it

When displaying user-controlled text:

```php
htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
```

### XSS rule

**Escape output when displaying user-controlled data.**

Do not assume that input is safe simply because it was validated when submitted.

---

# 8. CSRF Protection

Protect state-changing requests against Cross-Site Request Forgery.

Implement:

* [ ] CSRF tokens
* [ ] Server-side CSRF token validation
* [ ] CSRF protection for forms
* [ ] CSRF protection for state-changing requests
* [ ] Appropriate SameSite cookie configuration

CSRF protection should be applied to actions such as:

```text
Create
Update
Delete
Change password
Change email
Approve
Reject
Upload
Submit
```

### CSRF rule

A request that changes application data must not be trusted simply because the user is authenticated.

---

# 9. Rate Limiting and Abuse Protection

Implement rate limiting on endpoints that can be abused through repeated requests.

Important targets include:

* [ ] Login
* [ ] Registration
* [ ] Password reset
* [ ] OTP generation
* [ ] OTP verification
* [ ] Email sending
* [ ] API endpoints
* [ ] File uploads
* [ ] Other resource-intensive operations

Rate limiting may be based on:

* IP address
* User account
* Endpoint
* Time window
* Combination of multiple factors

### Example

```text
Login
5 failed attempts
within 5 minutes
        ↓
Temporary throttling
```

### Rate-limiting rule

Do not rely solely on IP-based limits because multiple legitimate users may share the same network.

Use account-based or endpoint-specific controls where appropriate.

---

# 10. Brute-Force Protection

Authentication endpoints must be protected against automated password guessing.

Implement:

* [ ] Login attempt tracking
* [ ] Failed-login throttling
* [ ] Temporary account restrictions where appropriate
* [ ] IP-based protection
* [ ] Account-based protection
* [ ] Monitoring of repeated failed attempts
* [ ] CAPTCHA or additional verification when appropriate

Avoid permanent account lockouts that could allow attackers to intentionally lock other users out.

---

# 11. Session Security

Sessions must be treated as sensitive authentication credentials.

Implement:

* [ ] Secure session IDs
* [ ] Session ID regeneration after login
* [ ] Session expiration
* [ ] Session invalidation after logout
* [ ] Idle session timeout
* [ ] Secure session cookies
* [ ] `HttpOnly` cookies
* [ ] `Secure` cookies when using HTTPS
* [ ] Appropriate `SameSite` cookie settings
* [ ] Protection against session fixation
* [ ] Protection against session hijacking

### Session rule

Never store sensitive authentication information in client-side JavaScript storage when a secure server-side session can be used instead.

---

# 12. File Upload Security

Any feature that accepts files must treat uploaded files as untrusted.

Implement:

* [ ] File extension validation
* [ ] MIME type validation
* [ ] File size limits
* [ ] Filename sanitization
* [ ] Randomized server-side filenames
* [ ] File content validation where appropriate
* [ ] Restriction of executable file types
* [ ] Safe upload directories
* [ ] Prevention of PHP/script execution in upload directories
* [ ] Authorization checks before accessing uploaded files

### File upload rule

Never trust the filename or MIME type supplied by the client.

Uploaded files should preferably be stored outside an executable web directory.

---

# 13. HTTPS and Transport Security

Production deployments must use HTTPS.

* [ ] SSL/TLS certificate
* [ ] HTTP → HTTPS redirection
* [ ] Secure cookies
* [ ] HTTPS for login
* [ ] HTTPS for authenticated requests
* [ ] HTTPS for API requests
* [ ] HTTPS for sensitive data transmission
* [ ] HSTS where appropriate

### HTTPS rule

Never transmit passwords, session credentials, or sensitive information over unencrypted HTTP.

---

# 14. Security Headers

Configure appropriate HTTP security headers.

Potential headers include:

* [ ] Content-Security-Policy (CSP)
* [ ] X-Content-Type-Options
* [ ] X-Frame-Options
* [ ] Referrer-Policy
* [ ] Strict-Transport-Security (HSTS)
* [ ] Permissions-Policy

Only enable/configure policies that are compatible with the application's actual functionality.

---

# 15. Error Handling

Errors must not expose sensitive information to users.

Development:

```text
Detailed errors
Debugging information
PHP errors
```

Production:

```text
User-friendly error messages
Detailed errors logged privately
```

Implement:

* [ ] Disable `display_errors` in production
* [ ] Enable appropriate server-side error logging
* [ ] Custom error pages
* [ ] Avoid exposing database errors
* [ ] Avoid exposing file paths
* [ ] Avoid exposing credentials
* [ ] Avoid exposing internal server information
* [ ] Avoid exposing stack traces

### Error-handling rule

Show users only the information they need. Log technical details privately for developers/administrators.

---

# 16. Environment and Secret Management

Sensitive credentials must never be committed to source control.

Protect:

* [ ] Database passwords
* [ ] Email credentials
* [ ] API keys
* [ ] Encryption keys
* [ ] Application secrets
* [ ] OAuth credentials
* [ ] Other private configuration

Use:

```text
.env
```

and add it to:

```text
.gitignore
```

Maintain:

```text
.env.example
```

containing placeholders instead of real credentials.

### Secret management rule

Never hard-code production credentials into PHP source code or commit them to GitHub.

---

# 17. Database Security

The database must follow the principle of least privilege.

Implement:

* [ ] Dedicated application database user
* [ ] Strong database password
* [ ] Minimum required database privileges
* [ ] Prepared statements
* [ ] Database connection encryption where appropriate
* [ ] Regular backups
* [ ] Backup testing
* [ ] Restricted database administration access
* [ ] Avoid using the MySQL `root` account for the application

The application should only have the database permissions it actually requires.

---

# 18. Data Protection

Sensitive data should be protected both during transmission and, where appropriate, while stored.

Implement where applicable:

* [ ] HTTPS encryption in transit
* [ ] Encryption of highly sensitive stored data
* [ ] Password hashing
* [ ] Secure handling of personal information
* [ ] Data minimization
* [ ] Appropriate data retention
* [ ] Secure deletion where required
* [ ] Restricted access to sensitive records

### Data protection rule

Do not encrypt passwords manually. Passwords should be **hashed**, not reversibly encrypted.

---

# 19. Audit Logging

Important security and administrative actions should be recorded.

Log events such as:

* [ ] Successful login
* [ ] Failed login
* [ ] Logout
* [ ] Password changes
* [ ] Password reset requests
* [ ] Account creation
* [ ] Account deletion
* [ ] Permission changes
* [ ] Administrative actions
* [ ] Important data modifications
* [ ] Suspicious activity
* [ ] Rate-limit violations

Audit records may include:

```text
User ID
Action
Target/resource
Timestamp
IP address
User agent
Result
```

### Audit-log rule

Do not log sensitive information such as plaintext passwords, authentication tokens, or private credentials.

---

# 20. Access Logging and Monitoring

Maintain appropriate server/application logs for detecting abnormal behavior.

Monitor:

* [ ] Repeated failed logins
* [ ] Unusual request volumes
* [ ] Repeated 403/401 responses
* [ ] Suspicious file uploads
* [ ] Rate-limit violations
* [ ] Unexpected administrative activity
* [ ] Repeated application errors
* [ ] Unusual API activity

Security logs should be protected against unauthorized modification or deletion.

---

# 21. Dependency Security

Third-party libraries and packages can contain vulnerabilities.

Implement:

* [ ] Regular dependency updates
* [ ] Vulnerability checking
* [ ] Remove unused dependencies
* [ ] Keep PHP updated
* [ ] Keep PHPMailer updated
* [ ] Keep JavaScript libraries updated
* [ ] Keep server software updated
* [ ] Review third-party packages before adding them

### Dependency rule

Do not install unnecessary packages or libraries simply because they are available.

---

# 22. Backup and Recovery

Security includes the ability to recover after an incident.

Implement:

* [ ] Regular database backups
* [ ] Backup verification
* [ ] Recovery testing
* [ ] Secure backup storage
* [ ] Multiple backup copies where appropriate
* [ ] Protection against unauthorized backup access

### Backup rule

A backup is not considered reliable until the recovery process has been tested.

---

# 23. API Security

If the system exposes APIs, apply security controls to every endpoint.

Implement:

* [ ] Authentication
* [ ] Authorization
* [ ] Input validation
* [ ] Rate limiting
* [ ] CSRF protection where applicable
* [ ] Request size limits
* [ ] Secure error responses
* [ ] Proper HTTP status codes
* [ ] Output encoding
* [ ] Protection against excessive data exposure

Never assume an API is safe simply because it is not directly visible in the website interface.

---

# 24. Security Testing

Security testing must be performed throughout development and again before deployment.

Test for:

* [ ] SQL injection
* [ ] XSS
* [ ] CSRF
* [ ] Broken authentication
* [ ] Broken authorization
* [ ] Session fixation
* [ ] Session hijacking risks
* [ ] Brute-force attacks
* [ ] Rate-limit bypasses
* [ ] Malicious file uploads
* [ ] Path traversal
* [ ] Unauthorized API access
* [ ] Information disclosure
* [ ] Insecure direct object references
* [ ] Weak password handling
* [ ] Improper error handling

---

# 25. Final Security Hardening

After all major functionality has been completed, perform a complete security review.

```text
Complete Features
       ↓
Security Audit
       ↓
Vulnerability Testing
       ↓
Configuration Review
       ↓
Dependency Review
       ↓
Fix Vulnerabilities
       ↓
Retest
       ↓
Production Deployment
```

The final security review should verify that security controls were not accidentally bypassed or weakened while developing other features.

---

# 26. Overall Security Rules

The following rules apply to the entire project:

1. **Never trust user input.**
2. **Never trust client-side validation as a security mechanism.**
3. **Never trust JavaScript to enforce permissions.**
4. **Never store plaintext passwords.**
5. **Never concatenate untrusted input into SQL queries.**
6. **Never commit secrets or credentials to GitHub.**
7. **Never expose detailed PHP/database errors in production.**
8. **Never allow untrusted uploaded files to execute as server-side code.**
9. **Always authenticate protected resources.**
10. **Always authorize sensitive actions on the server.**
11. **Always use HTTPS in production.**
12. **Always use secure session management.**
13. **Always validate and safely process user input.**
14. **Always escape untrusted output appropriately.**
15. **Always protect state-changing requests against CSRF where applicable.**
16. **Always rate-limit endpoints susceptible to abuse.**
17. **Always follow the principle of least privilege.**
18. **Always log important security events without logging secrets.**
19. **Always keep dependencies and server software updated.**
20. **Always maintain and test backups.**
21. **Always perform security testing before production deployment.**
22. **Security must be considered during feature development, not only after development is complete.**

---

# 27. Recommended Development Workflow

For every feature, follow this process:

```text
1. Plan the feature
        ↓
2. Identify possible security risks
        ↓
3. Implement the functionality
        ↓
4. Implement required security controls
        ↓
5. Test normal functionality
        ↓
6. Test unauthorized/malicious inputs
        ↓
7. Fix vulnerabilities
        ↓
8. Document the feature
        ↓
9. Move to the next feature
```

### Final principle

> **Build securely by default. Do not build an insecure system and attempt to secure it afterward.**
