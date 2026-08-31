# Project Development Master Prompt

## 1. Project Environment

This project is a web-based application using the following technology stack.

### Backend

* PHP
* MySQL
* PHPMailer for email sending

### Frontend

* HTML
* CSS
* JavaScript

### Local Development

* XAMPP
* Apache
* MySQL
* phpMyAdmin

### Production

* Hosted on Z.com
* Production environment must use HTTPS/SSL

### Source Control

* Git
* GitHub

---

# 2. Master Development Rules

**These rules apply to EVERY prompt, request, modification, bug fix, feature, refactor, and code change I make for this project.**

The security rules defined in the project's security `.md` file are the **global security requirements for the entire project**.

You must treat that document as a permanent development standard.

Do not treat its requirements as optional suggestions.

Every future request must be implemented while preserving and following all applicable rules from that document.

Security must be implemented **together with functionality**, not added afterward.

Follow this general workflow:

```text
My Prompt
    ↓
Understand Requested Change
    ↓
Check Project Security Rules
    ↓
Identify Security Implications
    ↓
Implement Requested Functionality
    ↓
Implement Required Security Controls
    ↓
Test Functionality
    ↓
Test Security
    ↓
Return Changes
```

---

# 3. Do Not Automatically Add Unrequested Features

Only implement what my prompt asks for.

Do not automatically add:

* Unrequested features
* Unrequested libraries
* Unrequested frameworks
* Unrequested database changes
* Unrequested architectural changes
* Unrequested UI changes
* Unrequested refactoring
* Unrequested offline functionality

Keep changes as small and targeted as reasonably possible.

Do not modify unrelated functionality unless it is necessary to complete the requested change or to maintain security.

---

# 4. Security Rules Apply to Every Prompt

For every request I make, automatically evaluate the applicable security requirements from the security `.md` file.

This includes, where applicable:

* HTTPS / SSL/TLS
* Secure environment configuration
* `.env` protection
* Secure database connections
* Database least privilege
* Secure sessions
* Secure cookies
* Authentication
* Password hashing
* Login protection
* Brute-force protection
* Rate limiting
* Password reset security
* Email verification
* MFA where appropriate
* Role-Based Access Control
* Server-side authorization
* Resource ownership checks
* Input validation
* SQL injection protection
* Prepared statements
* XSS protection
* Output encoding
* CSRF protection
* File upload security
* Security headers
* Secure error handling
* Secret management
* Data protection
* Audit logging
* Access logging
* API security
* Dependency security
* Backup and recovery
* Security testing

Do not weaken an existing security control simply to make a requested feature easier to implement.

If a requested feature conflicts with an existing security requirement, prioritize the security requirement and explain the conflict.

---

# 5. Universal Input Security Rule

Treat all data coming from the user, browser, API, URL, cookies, headers, uploaded files, or external requests as **untrusted**.

Never assume client-side validation is sufficient.

Client-side JavaScript validation is only for usability.

Important validation must always be performed server-side using PHP.

---

# 6. Universal Database Security Rule

All database queries must use prepared statements or parameterized queries.

Use PDO or MySQLi with prepared statements.

Never concatenate untrusted user input directly into SQL queries.

The application must follow the principle of least privilege.

Do not use the MySQL `root` account for the production application.

---

# 7. Universal Authentication and Authorization Rule

Authentication determines who the user is.

Authorization determines what the user is allowed to do.

Every protected resource and sensitive action must perform server-side authorization checks.

Never rely on:

* Hidden buttons
* Disabled buttons
* JavaScript restrictions
* Frontend routing
* Hidden form fields
* Client-side role checks

as the actual security mechanism.

A user must not be able to bypass permissions simply by manually calling a PHP endpoint or changing a URL.

---

# 8. Universal Secret Management Rule

Never hard-code sensitive credentials into source code.

Sensitive values must be stored in an environment configuration such as:

```text
.env
```

The `.env` file must be included in `.gitignore`.

Use:

```text
.env.example
```

for a safe template containing placeholders only.

Never commit:

* Database passwords
* SMTP passwords
* API keys
* Encryption keys
* Application secrets
* OAuth credentials
* Other production credentials

to GitHub.

---

# 9. Offline Feature — Confirmation Required

The project may support offline functionality using:

* Service Worker
* Cache API
* IndexedDB
* JavaScript
* PHP API endpoints
* MySQL

However:

## IMPORTANT

**DO NOT automatically apply offline functionality to every feature or future change.**

Before adding or modifying offline behavior for any feature, you must:

1. Determine whether offline functionality is relevant.
2. Explain what offline changes would be required.
3. Identify the affected files/components.
4. **WAIT FOR MY EXPLICIT CONFIRMATION.**
5. Only implement the offline portion after I confirm.

If I do not confirm, implement only the requested feature without adding offline functionality.

This rule exists to prevent unnecessary modifications and conserve usage limits.

---

# 10. HTTPS Requirement

Production deployment on Z.com must use HTTPS.

The production environment must have:

* Valid SSL/TLS certificate
* HTTP → HTTPS redirection
* HTTPS API requests
* HTTPS authentication
* Secure cookies
* HTTPS transmission of sensitive information

Never transmit passwords, authentication credentials, or sensitive information over unencrypted HTTP.

Service Workers must operate through a secure context.

For local XAMPP development, `localhost` may be used for Service Worker development because browsers generally treat localhost as a secure development context.

---

# 11. Offline Architecture

When I explicitly approve offline functionality for a particular feature, use the following architecture.

## IndexedDB

Use IndexedDB to store pending submissions when the browser is offline.

Frontend submission logic should check:

```javascript
navigator.onLine
```

### Online

```text
User submits
     ↓
navigator.onLine
     ↓
PHP API
     ↓
MySQL
```

### Offline

```text
User submits
     ↓
navigator.onLine = false
     ↓
IndexedDB
     ↓
Wait for connection
```

Offline records must remain persistent across page refreshes and browser navigation.

---

# 12. Service Worker

When offline functionality has been explicitly approved, create:

```text
/sw.js
```

The Service Worker should use the Cache API to cache the application's core static resources during installation.

Examples:

* Core HTML
* CSS
* JavaScript
* Logos
* Icons
* Required static assets

Do not blindly cache sensitive or dynamic API responses.

Separate static resources from dynamic application/database requests.

---

# 13. Service Worker Registration

Register the Service Worker from the application's frontend JavaScript.

Example:

```javascript
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}
```

Prefer centralized registration rather than unnecessarily duplicating the registration code across every page.

---

# 14. PHP API Receiver

When offline synchronization has been approved for a feature, create a dedicated PHP API endpoint.

Example:

```text
/api/receiver.php
```

The endpoint must:

* Accept raw JSON
* Validate the HTTP method
* Validate Content-Type
* Decode JSON safely
* Validate required fields
* Validate data types
* Validate allowed values
* Perform server-side validation
* Authenticate where required
* Authorize where required
* Apply CSRF protection where applicable
* Apply rate limiting where appropriate
* Use prepared SQL statements
* Insert validated data into MySQL
* Return JSON
* Use appropriate HTTP status codes
* Never render HTML

Example successful response:

```json
{
    "success": true,
    "message": "Data successfully synchronized."
}
```

Example failure response:

```json
{
    "success": false,
    "message": "Invalid request."
}
```

---

# 15. Offline Synchronization

When explicitly approved, the Service Worker may synchronize pending IndexedDB records when network connectivity returns.

The process should be:

```text
Network Restored
       ↓
Service Worker
       ↓
Open IndexedDB
       ↓
Retrieve Pending Records
       ↓
Send to PHP API
       ↓
Validate on Server
       ↓
Insert into MySQL
       ↓
Successful Response?
     /       \
   YES        NO
    ↓          ↓
Delete      Keep Record
Local       for Retry
Record
```

Never delete a queued IndexedDB record merely because an HTTP request was attempted.

Only remove it after confirmed successful server-side processing.

---

# 16. Visibility-Aware Polling

The application should use visibility-aware polling for applicable pages.

Polling must use separate refresh intervals depending on page visibility.

## Fast Polling

When the page is visible:

```javascript
const FAST_INTERVAL = 10000;
```

The actual interval should be configurable.

## Slow Polling

When the page is hidden:

```javascript
const SLOW_INTERVAL = 60000;
```

The actual interval should be configurable.

Use the Page Visibility API:

```javascript
document.visibilityState
```

and:

```javascript
document.addEventListener('visibilitychange', ...)
```

### Visible

```text
Page Visible
     ↓
Stop Slow Polling
     ↓
Optional Immediate Refresh
     ↓
Start Fast Polling
```

### Hidden

```text
Page Hidden
     ↓
Stop Fast Polling
     ↓
Start Slow Polling
```

Never allow multiple polling timers to run simultaneously.

Where practical, use a reusable polling utility such as:

```text
/assets/js/polling.js
```

Individual pages should provide their refresh function to the shared polling mechanism.

---

# 17. Error Handling

Development and production environments must have different error-handling behavior.

### Development

Detailed debugging information may be enabled locally.

### Production

Do not expose:

* PHP stack traces
* Database errors
* File paths
* Credentials
* Internal server information
* Debugging information

Production should return safe, user-friendly error messages while technical details are logged privately.

---

# 18. Security Logging

Important security and administrative actions should be logged where applicable.

Examples:

* Successful login
* Failed login
* Logout
* Password changes
* Password reset requests
* Account creation
* Account deletion
* Permission changes
* Administrative actions
* Important data modifications
* Suspicious activity
* Rate-limit violations

Never log:

* Plaintext passwords
* Authentication tokens
* API secrets
* Database passwords
* Private credentials

---

# 19. Dependency Rules

Do not add a new library or package unless it is necessary.

Existing dependencies should be kept updated.

Pay particular attention to:

* PHP
* PHPMailer
* JavaScript libraries
* Server software
* Other third-party packages

Remove unused dependencies where appropriate.

---

# 20. File Upload Rules

Any feature involving uploads must include appropriate protection.

Validate:

* File extension
* MIME type
* File size
* Filename
* File contents where appropriate

Use randomized server-side filenames.

Prevent executable files from being executed inside upload directories.

Perform authorization checks before allowing access to uploaded files.

Never trust the filename or MIME type supplied by the client.

---

# 21. Security Testing

When implementing a feature, consider whether it introduces risks involving:

* SQL injection
* XSS
* CSRF
* Authentication bypass
* Authorization bypass
* Session fixation
* Session hijacking
* Brute-force attacks
* Rate-limit bypass
* Malicious uploads
* Path traversal
* Unauthorized API access
* Information disclosure
* IDOR
* Weak password handling
* Improper error handling

Test both:

```text
Normal Request
```

and:

```text
Unauthorized / Malicious Request
```

---

# 22. Future Prompt Processing Rule

For **EVERY prompt I send**, follow this process before making changes:

```text
                    MY PROMPT
                       ↓
             Identify Requested Change
                       ↓
             Check Security Rules
                       ↓
          Check Existing Functionality
                       ↓
       Determine Required Security Controls
                       ↓
       Determine Whether Offline Is Relevant
                       ↓
        ┌──────────────┴──────────────┐
        │                             │
 Offline Not Needed             Offline Needed
        │                             │
        ↓                             ↓
Implement Request            STOP AND ASK
+ Security Controls          FOR CONFIRMATION
        │                             │
        │                     Wait for Approval
        │                             │
        └──────────────┬──────────────┘
                       ↓
                 Test Changes
                       ↓
             Test Security Impact
                       ↓
                Return Result
```

---

# 23. Conflict Resolution

If my prompt conflicts with these development rules:

### Security rules take priority over convenience.

If a requested implementation would create a security vulnerability:

1. Do not knowingly implement the insecure approach.
2. Explain the security issue.
3. Provide a secure alternative.
4. Only proceed with an implementation that satisfies the security requirements.

If the request requires a major architectural change, explain the change before applying it.

If the request requires offline functionality, follow the **Offline Confirmation Required** rule.

---

# 24. Minimal-Change Principle

When modifying the project:

* Modify only what is necessary.
* Preserve existing functionality.
* Preserve existing UI unless modification is requested.
* Preserve existing database behavior unless modification is necessary.
* Avoid unnecessary refactoring.
* Avoid unnecessary dependencies.
* Avoid unnecessary file creation.
* Avoid automatically applying offline support.
* Avoid changing unrelated code.

The goal is to make each requested change **safely, minimally, and predictably**.

---

# 25. Final Global Instruction

**Treat this entire document and the project's security `.md` file as permanent global development rules.**

Every prompt I make in the future must follow these rules.

Do not require me to repeat the security requirements in every prompt.

For each request, automatically apply all security controls relevant to that request.

However, **offline functionality is an exception**:

> **Never automatically add offline functionality to a feature merely because the project supports offline functionality. Ask for my explicit confirmation first.**

The project must be developed using the following principle:

```text
SECURE BY DEFAULT
       +
MINIMAL CHANGES
       +
SECURITY WITH FUNCTIONALITY
       +
EXPLICIT OFFLINE APPROVAL
       +
TEST BEFORE DEPLOYMENT
```

### Final Principle

**Build securely by default. Every feature must be developed with its applicable security controls from the beginning. Never build an insecure feature and plan to secure it later.**
