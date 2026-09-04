# Security Rules

## 1. Purpose

This document contains the mandatory security requirements for the project.

These requirements apply throughout:

* Development
* Testing
* Database operations
* API development
* Authentication
* Authorization
* File uploads
* Email functionality
* Offline functionality
* Production configuration
* Deployment
* Maintenance

Security must be implemented together with functionality rather than added afterward.

If a user's requested implementation conflicts with these requirements, do not knowingly implement the insecure approach.

---

# 2. Security Principles

The project must follow these principles:

```text
SECURE BY DEFAULT
        ↓
LEAST PRIVILEGE
        ↓
SERVER-SIDE VALIDATION
        ↓
DEFENSE IN DEPTH
        ↓
MINIMAL DATA EXPOSURE
        ↓
SAFE ERROR HANDLING
        ↓
SECURE SECRET MANAGEMENT
```

Never rely solely on frontend security controls.

Anything enforced only through JavaScript or HTML can potentially be bypassed.

Security-sensitive decisions must be enforced server-side.

---

# 3. Secret Management

Never hard-code secrets into source code.

Secrets include:

* Database passwords
* SMTP passwords
* API keys
* Application secrets
* Encryption keys
* Authentication secrets
* Production credentials
* Other private credentials

Use environment variables.

The local environment should use:

```text
.env
```

The repository should contain:

```text
.env.example
```

with placeholders only.

Never commit `.env`.

Never expose `.env` contents through:

* PHP responses
* API responses
* JavaScript
* HTML
* Logs
* Error messages
* GitHub

---

# 4. Git Security

Never commit:

```text
.env
```

Never commit:

* Passwords
* API keys
* SMTP credentials
* Database credentials
* Private certificates
* Private keys
* Production secrets
* Sensitive configuration

Before committing, verify that sensitive information has not been added.

If a secret is accidentally committed, treat it as compromised and rotate it where appropriate.

Do not rely solely on `.gitignore` as a security mechanism.

---

# 5. Database Security

Use prepared statements for database queries.

Never construct SQL queries by directly concatenating untrusted user input.

Use parameterized queries.

Validate input before database operations.

Use database accounts with the minimum privileges required by the application.

Do not use unnecessary administrative database credentials for the application.

Do not expose database credentials to the frontend.

Never allow browser-side JavaScript to connect directly to MySQL.

The database should only be accessed through the server-side application.

---

# 6. Input Validation

All user-controlled input must be treated as untrusted.

Validate input server-side.

Validation should consider:

* Required fields
* Data types
* Length
* Format
* Range
* Allowed values
* Business rules
* File types
* Numeric limits
* Character limits

Client-side validation may improve user experience but must never replace server-side validation.

---

# 7. Output Encoding and XSS Protection

Treat user-generated content as untrusted.

Escape output according to its context.

For HTML output, use appropriate HTML escaping.

For JavaScript contexts, use appropriate JavaScript-safe handling.

For URLs, use appropriate URL encoding and validation.

Do not insert untrusted data into HTML using unsafe DOM APIs.

Avoid unsafe patterns such as:

```javascript
element.innerHTML = untrustedData;
```

unless the content has been safely sanitized for the intended context.

Use safe DOM APIs where practical.

---

# 8. Authentication

Authentication must be performed server-side.

Passwords must never be stored in plaintext.

Use PHP's password hashing mechanisms, such as:

```php
password_hash()
```

and:

```php
password_verify()
```

Do not implement custom password hashing algorithms.

Authentication failures should not reveal unnecessary information about whether an account exists.

Protected endpoints must verify authentication server-side.

---

# 9. Authorization

Authentication and authorization are separate requirements.

Being authenticated does not automatically mean a user is authorized to perform every action.

Every protected operation must verify the user's permissions server-side.

Never rely solely on:

* Hidden buttons
* Disabled buttons
* JavaScript checks
* URL obscurity
* Frontend role checks

Users must not be able to access or modify resources merely by changing IDs or request parameters.

Use server-side ownership and permission checks.

---

# 10. Session Security

Use secure PHP session configuration.

Where applicable:

* Use secure session cookies.
* Use `HttpOnly`.
* Use `Secure` when HTTPS is available.
* Use an appropriate `SameSite` policy.
* Regenerate session IDs after authentication.
* Destroy sessions on logout.
* Avoid exposing session identifiers.
* Do not place session identifiers in URLs.

Session handling must follow the application's authentication architecture.

---

# 11. CSRF Protection

State-changing browser requests should use appropriate CSRF protection where applicable.

Protect operations such as:

* Creating records
* Updating records
* Deleting records
* Changing account information
* Changing permissions
* Other authenticated state-changing actions

CSRF protection must be validated server-side.

Do not rely solely on JavaScript checks.

For API endpoints, determine whether the request mechanism is inherently protected against CSRF or whether an explicit CSRF mechanism is required.

Do not weaken CSRF protection simply to simplify implementation.

---

# 12. XSS, SQL Injection, and CSRF

The application must specifically defend against:

```text
XSS
SQL Injection
CSRF
```

For SQL injection:

* Use prepared statements.
* Never concatenate untrusted input into SQL.

For XSS:

* Validate input where appropriate.
* Encode output according to context.
* Avoid unsafe DOM insertion.

For CSRF:

* Use appropriate anti-CSRF mechanisms for state-changing browser requests.

---

# 13. API Security

All API endpoints must be treated as directly accessible by an attacker.

Do not assume an API is safe because it is only called by the frontend.

APIs should:

* Validate HTTP methods.
* Validate `Content-Type` where applicable.
* Validate request bodies.
* Validate input.
* Authenticate protected requests.
* Authorize protected actions.
* Apply CSRF protection where applicable.
* Apply rate limiting where appropriate.
* Return appropriate HTTP status codes.
* Return safe JSON responses.
* Avoid excessive data exposure.
* Avoid revealing internal implementation details.

Never trust frontend restrictions.

---

# 14. JSON API Security

For endpoints accepting JSON:

1. Validate the HTTP method.
2. Validate `Content-Type`.
3. Read the raw request body safely.
4. Decode JSON safely.
5. Detect malformed JSON.
6. Validate required fields.
7. Validate data types.
8. Validate allowed values.
9. Authenticate the request where required.
10. Authorize the requested operation.
11. Perform server-side business validation.
12. Execute the database operation using prepared statements.
13. Return structured JSON.
14. Use appropriate HTTP status codes.
15. Avoid exposing sensitive information.

Never render HTML from an endpoint intended to be a JSON API.

---

# 15. Rate Limiting

Apply rate limiting where appropriate.

Rate limiting should be considered for:

* Login attempts
* OTP requests
* Password reset requests
* Email sending
* Public APIs
* Expensive operations
* Repeated submissions
* Other abuse-prone endpoints

Rate limits should be appropriate to the application's legitimate usage.

Do not create rate limits so restrictive that normal users cannot use the system.

---

# 16. File Upload Security

Never trust uploaded files.

Validate:

* File size
* File extension
* MIME type
* File content where appropriate
* Filename
* User authorization

Use randomized filenames where appropriate.

Do not use user-provided filenames directly as filesystem paths.

Uploaded files must not be executable as server-side code.

Store uploads outside executable server directories where practical.

Restrict access to private uploads.

Do not allow unrestricted directory traversal.

---

# 17. Path Traversal

Never directly use user-controlled paths in filesystem operations.

Reject path traversal attempts such as:

```text
../
..\ 
```

Resolve and validate paths against an allowed base directory.

Never allow users to select arbitrary server-side files.

---

# 18. Error Handling

Do not expose internal errors to production users.

Never expose:

* Database credentials
* SQL queries
* PHP stack traces
* Server filesystem paths
* Internal application structure
* Sensitive configuration
* Authentication information

Production errors should provide safe user-facing messages.

Detailed errors should be logged privately where appropriate.

---

# 19. Security Headers

Where supported by the hosting environment, configure appropriate security headers.

Consider:

* `Content-Security-Policy`
* `Strict-Transport-Security`
* `X-Content-Type-Options`
* `Referrer-Policy`
* `Permissions-Policy`
* Appropriate framing protections such as `frame-ancestors`

Headers must be configured in a way compatible with the application's actual functionality.

Do not blindly deploy a restrictive policy that breaks legitimate functionality.

---

# 20. HTTPS

Production must use HTTPS.

Sensitive information must never be transmitted over unencrypted HTTP.

Verify:

* Valid TLS certificate
* HTTPS availability
* HTTP → HTTPS redirection
* HTTPS API requests
* HTTPS authentication
* Secure cookies
* Service Worker HTTPS requirements

Do not mix secure pages with insecure sensitive requests.

Avoid mixed content.

---

# 21. PHPMailer and Email Security

PHPMailer must be configured securely.

SMTP credentials must be stored in environment variables.

Never expose SMTP credentials to frontend JavaScript.

Do not place SMTP credentials directly in tracked PHP files.

Use encrypted SMTP/TLS connections where supported by the mail provider.

Validate recipient addresses appropriately.

Do not allow untrusted user input to control arbitrary SMTP configuration.

Email functionality should have appropriate rate limiting where abuse is possible.

---

# 22. Authentication Emails and OTPs

If the application uses OTPs or authentication emails:

* Generate cryptographically secure random values.
* Store them securely.
* Expire them after an appropriate period.
* Limit verification attempts.
* Rate-limit requests.
* Do not expose OTP values in URLs unnecessarily.
* Do not log OTP values.
* Do not expose OTPs in API responses.
* Invalidate used OTPs.

---

# 23. Sensitive Data Exposure

Collect and return only data required for the requested operation.

Do not expose unnecessary:

* User information
* Database fields
* Internal IDs
* Administrative information
* Authentication information
* Private records

API responses should contain only the data required by the client.

---

# 24. Database Credentials

The application must not use database credentials in frontend code.

Database credentials belong exclusively on the server.

Production database credentials must be stored in the production environment configuration.

Use a dedicated application database user with only the privileges required by the application.

---

# 25. Production Configuration

Production should:

* Disable unnecessary debugging.
* Disable detailed error output.
* Protect environment files.
* Use HTTPS.
* Use secure cookies.
* Use appropriate security headers.
* Use production database credentials.
* Use appropriate file permissions.
* Protect uploads.
* Use secure email configuration.
* Keep dependencies appropriately maintained.

---

# 26. Offline Security

Offline functionality is opt-in and requires explicit user approval before implementation.

When offline functionality is approved:

* Do not bypass authentication.
* Do not bypass authorization.
* Do not bypass CSRF protection where applicable.
* Do not store sensitive data unnecessarily.
* Do not blindly cache private information.
* Do not expose private API responses through the Cache API.
* Protect IndexedDB data appropriately.
* Validate queued data again on the server.
* Treat queued data as untrusted.
* Prevent unauthorized synchronization.
* Prevent duplicate processing.
* Do not trust the client to determine authorization.

Offline functionality must preserve the same security expectations as the online application.

---

# 27. Service Worker Security

Service Workers must not:

* Cache authentication responses unnecessarily.
* Cache sensitive personal data unnecessarily.
* Cache private API responses indiscriminately.
* Bypass authentication.
* Bypass authorization.
* Modify security-sensitive requests without a defined reason.

Only cache resources that are safe and required for offline functionality.

Service Worker changes require explicit offline approval under `PROJECT_RULES.md`.

---

# 28. IndexedDB Security

IndexedDB should contain only the data required for the approved offline feature.

Do not assume IndexedDB is a secure secret store.

Avoid storing:

* Passwords
* Authentication secrets
* SMTP credentials
* Database credentials
* API keys
* Other highly sensitive secrets

Queued records must be treated as client-controlled data.

All synchronized records must undergo server-side validation and authorization.

---

# 29. Offline Synchronization Security

Background synchronization must not create a security bypass.

Before implementing synchronization, determine:

* How the request is authenticated.
* How authorization is verified.
* How CSRF protection is handled where applicable.
* How duplicate submissions are prevented.
* How replayed requests are handled.
* How expired authentication is handled.
* How failed requests are retried.
* How sensitive data is protected locally.

Never delete a queued record merely because a request was sent.

Only remove it after successful server confirmation.

---

# 30. Logging

Logs must not contain sensitive information unnecessarily.

Do not log:

* Passwords
* OTPs
* API keys
* SMTP credentials
* Database passwords
* Authentication tokens
* Session secrets

Log security-relevant events where appropriate.

Production logs should be protected from unauthorized access.

---

# 31. Dependency Security

Before adding a dependency:

* Determine whether it is necessary.
* Review its security status.
* Prefer maintained dependencies.
* Avoid unnecessary packages.
* Avoid duplicate functionality.

Keep project dependencies appropriately maintained.

Do not introduce a dependency solely for convenience when the existing stack can safely perform the required task.

---

# 32. Access Control

Sensitive administrative functions must have appropriate authorization.

Examples include:

* User management
* Role management
* Permission management
* Database-related administration
* File management
* System configuration
* Organization management
* Other privileged operations

Never rely solely on hidden frontend navigation.

---

# 33. IDOR and Resource Authorization

Never assume that a numeric or public resource ID is sufficient authorization.

For example:

```text
/resource.php?id=123
```

must not automatically grant access to resource `123`.

The server must verify that the authenticated user is authorized to access the requested resource.

This applies to:

* View
* Edit
* Delete
* Download
* Approve
* Manage
* Other operations

---

# 34. Production Backups

Production data should have an appropriate backup strategy.

Backups should be:

* Performed appropriately.
* Protected from unauthorized access.
* Stored separately where practical.
* Tested for restoration where appropriate.

Database backups must not be exposed through the public web directory.

---

# 35. Security Testing

Where applicable, test for:

* SQL injection
* XSS
* CSRF
* Authentication bypass
* Authorization bypass
* IDOR
* Session issues
* Invalid input
* Malformed JSON
* Direct API access
* Rate-limit bypass
* File upload abuse
* Path traversal
* Information disclosure
* Sensitive data exposure

Security testing should be performed locally before production deployment where practical.

---

# 36. Production Security Review

Before production deployment, review:

```text
Authentication
Authorization
Input Validation
SQL Injection Protection
XSS Protection
CSRF Protection
Session Security
Rate Limiting
File Upload Security
Path Traversal Protection
HTTPS
Security Headers
Error Handling
Secret Management
Database Security
API Security
Email Security
Offline Security
Logging
Dependency Security
Backup/Recovery
```

Do not deploy knowingly insecure functionality.

---

# 37. Security Conflict Rule

If a requested implementation conflicts with these security requirements:

1. Do not knowingly implement the insecure approach.
2. Explain the security issue.
3. Provide a secure implementation or alternative.
4. Preserve the requested functionality as much as reasonably possible.

Security requirements must not be weakened merely to reduce development effort.

---

# 38. Core Security Principle

The project must follow:

```text
SECURE BY DEFAULT
        +
LEAST PRIVILEGE
        +
SERVER-SIDE VALIDATION
        +
DEFENSE IN DEPTH
        +
MINIMAL DATA EXPOSURE
        +
SECURE SECRET MANAGEMENT
        +
SAFE ERROR HANDLING
        +
SECURITY WITH FUNCTIONALITY
```

> Security is a mandatory part of every applicable feature. Never knowingly introduce a security vulnerability for convenience.

---

# 39. Vite, XAMPP, Cloudflare, and Z.com Security Profile

These requirements apply to this reusable project architecture.

## Frontend build security

* Treat all React code, `index.html`, compiled `dist/` files, and `VITE_*` variables as public.
* Never place passwords, database credentials, SMTP credentials, private API keys, session secrets, or privileged tokens in Vite configuration or frontend variables.
* Keep `package-lock.json` tracked and review it when dependencies change.
* Do not manually modify compiled files as the source of truth; modify `src/`, rebuild, and redeploy.
* Do not deploy development source maps unless explicitly required and reviewed for information exposure.
* Self-host production frontend dependencies through the Vite build. Adding a third-party runtime CDN requires an explicit, reviewed reason and compatible security headers.

## Local XAMPP security

* Application PHP must use a dedicated least-privilege MariaDB/MySQL user, never the root account.
* phpMyAdmin is an administration interface only. Do not expose it through public tunnels or link it from the application.
* Keep the local `.env` untracked and deny direct HTTP access.
* Do not use real production/customer data for publicly shared development previews.
* Keep local, preview, and production databases logically separated. The Cloudflare preview may use the local development database only.

## Cloudflare preview security

* Tunnel only a restricted project-specific origin that serves compiled `dist/` files and intended PHP APIs.
* Never tunnel the full XAMPP document root or port 80 when it would expose dashboards, phpMyAdmin, other projects, `.env`, Git metadata, backups, or internal files.
* Confirm `/.env`, `/phpmyadmin/`, `/src/`, `/.git/`, internal Markdown files, and database backups return `403` or `404` through the public URL.
* Quick Tunnel URLs are public bearer links, randomly generated, temporary, and unsuitable for production.
* Keep authentication and authorization enabled during previews. A hard-to-guess URL is not access control.
* Stop verification tunnels when testing is complete. Do not start an ongoing public tunnel without the user's authorization.

## Z.com production security

* Use a new production database, application user, and password. Never upload or reuse the local `.env`.
* Prefer storing production environment configuration outside `public_html`. If hosting constraints require a protected file under the web root, deny HTTP access and verify that denial on the live domain.
* Deploy only compiled frontend output and required PHP/runtime files into `public_html`.
* Do not deploy `src/`, `node_modules/`, local scripts, Git metadata, rule files, logs, local database backups, or development credentials.
* Disable public PHP error display, keep detailed logs private, enforce HTTPS, and configure secure cookies and compatible security headers.
* Apply database migrations through a reviewed and recoverable process. Back up affected production data before destructive changes.
* After every deployment, verify critical flows, authorization, database targeting, protected-file denial, and safe error responses over HTTPS.
