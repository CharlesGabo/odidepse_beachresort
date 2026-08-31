# Project Development Rules

## 1. Purpose of This Document

This document contains the global development rules for this project.

These rules apply to **every prompt, feature, modification, bug fix, refactor, optimization, database change, UI change, API change, and code change** made to this project.

The project also contains a separate:

```text
SECURITY_RULES.md
```

`SECURITY_RULES.md` contains the project's mandatory security requirements.

Both documents must be followed for every development task.

### Rule Priority

For every request:

```text
PROJECT_RULES.md
        +
SECURITY_RULES.md
        +
User's Current Request
        ↓
Final Implementation
```

The current request determines what should be changed, while these rule files determine **how the change must be implemented**.

Security requirements must always be applied when relevant.

---

# 2. Technology Stack

The project uses the following technology stack.

## Backend

* PHP
* MySQL
* PHPMailer for email sending

## Frontend

* HTML
* CSS
* JavaScript

## Local Development

* XAMPP
* Apache
* MySQL
* phpMyAdmin

## Production

* Z.com hosting
* HTTPS/SSL

## Version Control

* Git
* GitHub

---

# 3. Development Environment

Development should primarily be performed locally using XAMPP.

The local environment should be used for:

* Developing features
* Testing functionality
* Testing database operations
* Testing PHP
* Testing JavaScript
* Testing email functionality
* Testing security controls
* Testing approved offline functionality

The production Z.com environment should not be used as the primary development environment.

---

# 4. Master Development Rule

**Implement only what the current prompt requests, while following all applicable rules in `PROJECT_RULES.md` and `SECURITY_RULES.md`.**

Do not automatically add unrelated features.

Do not automatically refactor unrelated code.

Do not automatically redesign unrelated interfaces.

Do not automatically modify unrelated database structures.

Do not automatically add new dependencies.

Do not automatically apply offline functionality.

Keep changes as targeted and minimal as reasonably possible.

---

# 5. Every Prompt Must Follow These Rules

For every prompt I provide, follow this process:

```text
                    MY PROMPT
                       ↓
             Understand the Request
                       ↓
             Check PROJECT_RULES.md
                       ↓
             Check SECURITY_RULES.md
                       ↓
            Identify Security Impact
                       ↓
          Identify Required Dependencies
                       ↓
         Determine Whether Offline Support
                 Is Relevant
                       ↓
              Implement the Request
                       ↓
              Apply Security Controls
                       ↓
                Test Functionality
                       ↓
                 Test Security
                       ↓
                 Return Changes
```

Do not require me to repeat these rules in every prompt.

These rules should be treated as persistent project instructions.

---

# 6. Minimal-Change Principle

When modifying the project:

* Modify only what is necessary.
* Preserve existing functionality.
* Preserve existing UI unless modification is requested.
* Preserve existing database behavior unless modification is required.
* Preserve existing API behavior unless modification is required.
* Avoid unnecessary refactoring.
* Avoid unnecessary dependencies.
* Avoid unnecessary file creation.
* Avoid changing unrelated files.
* Avoid changing existing functionality simply because another implementation may be preferred.

If an existing implementation already works and does not conflict with the requested change or security requirements, do not unnecessarily replace it.

---

# 7. Do Not Add Unrequested Features

Do not add features simply because they may be useful.

Examples of features that must not be added without being requested include:

* New authentication methods
* New dashboards
* New notifications
* New APIs
* New database tables
* New frameworks
* New libraries
* New UI components
* New caching systems
* New background processes
* Offline functionality
* Additional analytics
* Additional automation

If a feature would be useful but was not requested, mention it separately rather than implementing it automatically.

---

# 8. Security Rules

The project has a dedicated:

```text
SECURITY_RULES.md
```

This file contains the complete security requirements.

It must be followed for every applicable change.

Security must be implemented together with functionality rather than added afterward.

The general development principle is:

```text
Build Feature
      ↓
Implement Required Security Controls
      ↓
Test Functionality
      ↓
Test Security
      ↓
Continue Development
```

Never intentionally implement an insecure approach merely because it is easier or faster.

If the requested implementation conflicts with a security requirement:

1. Do not knowingly implement the insecure approach.
2. Explain the security issue.
3. Use a secure implementation where possible.
4. Preserve the requested functionality.

---

# 9. Environment Configuration

Sensitive configuration must be stored in environment variables.

Use:

```text
.env
```

for local and production environment-specific secrets.

Use:

```text
.env.example
```

as a safe template containing placeholders only.

The `.env` file must never be committed to GitHub.

Example:

```text
.env
.env.example
.gitignore
```

The `.env` file may contain:

* Database credentials
* SMTP credentials
* Application secrets
* API keys
* Other environment-specific sensitive configuration

Never hard-code production credentials into PHP, JavaScript, HTML, or configuration files that are committed to GitHub.

---

# 10. Git and GitHub

Git and GitHub are used for version control throughout development.

The normal development workflow is:

```text
XAMPP
  ↓
Develop
  ↓
Test Locally
  ↓
Git Commit
  ↓
Git Push
  ↓
GitHub
```

Commit changes regularly using meaningful commit messages.

Do not commit:

* `.env`
* Passwords
* API keys
* SMTP credentials
* Database credentials
* Private secrets
* Sensitive production configuration

The following project files should normally be tracked:

```text
PROJECT_RULES.md
SECURITY_RULES.md
.env.example
Source Code
```

The following should normally not be tracked:

```text
.env
```

---

# 11. Deployment and Production Workflow

The project should be developed locally first.

Do not deploy the unfinished system to Z.com merely to establish a live website.

The intended production workflow is:

```text
Local Development
      ↓
XAMPP Testing
      ↓
Git Commit
      ↓
GitHub
      ↓
System Completion
      ↓
Final Local Testing
      ↓
Configure Z.com Git Deployment
      ↓
Configure Production Environment
      ↓
Deploy from GitHub to Z.com
      ↓
Production Testing
      ↓
Live Website
```

The production deployment should be established through the Git deployment workflow rather than manually uploading the finished system first and connecting Git deployment afterward.

### Important

Git deployment does **not** need to be configured immediately during early development.

Git/GitHub version control should be used now.

Z.com Git deployment should be configured when the project is approaching production deployment.

---

# 12. Z.com Production Environment

When preparing for production deployment, configure the Z.com environment separately from the local XAMPP environment.

Production configuration should include, where applicable:

* Production `.env`
* Production MySQL database
* Dedicated production database user
* Production PHPMailer/SMTP configuration
* HTTPS/SSL
* Production PHP configuration
* Secure file permissions
* Secure upload directories
* Production error handling
* Required security headers
* Production session/cookie settings
* Database backups

The production `.env` must not be copied into GitHub.

---

# 13. Local and Production Environments

The local and production environments may use different configuration values.

### Local

```text
XAMPP
localhost
Local MySQL
Local database credentials
Development email configuration
```

### Production

```text
Z.com
HTTPS
Production MySQL
Production database credentials
Production email configuration
```

Application code should use environment configuration rather than hard-coded environment-specific values.

---

# 14. Offline Functionality — Explicit Confirmation Required

The project may support offline functionality using:

* Service Worker
* Cache API
* IndexedDB
* JavaScript
* PHP API endpoints
* MySQL

However, offline functionality is **opt-in for individual features**.

## CRITICAL RULE

**Never automatically add offline functionality to a feature simply because the project has an offline architecture.**

For every future prompt:

1. Determine whether the requested change involves a feature that could benefit from offline functionality.
2. If offline functionality is not relevant, implement the requested feature normally.
3. If offline functionality is relevant, identify the required offline changes.
4. Explain which files/components would need to be modified.
5. **STOP and wait for my explicit confirmation.**
6. Only implement the offline portion after I explicitly approve it.

Do not assume approval.

Do not silently add IndexedDB support.

Do not silently modify the Service Worker.

Do not silently add offline caching.

Do not silently modify submission logic to queue requests.

This rule exists to prevent unnecessary modifications and conserve usage limits.

---

# 15. Offline Feature Architecture

Only implement the following offline architecture after explicit confirmation for the relevant feature.

The intended architecture is:

```text
USER SUBMITS DATA
        ↓
navigator.onLine?
     /       \
   YES        NO
    |          |
    ↓          ↓
 PHP API    IndexedDB
    |          |
    ↓          |
  MySQL        |
               |
        Network Restored
               |
               ↓
        Service Worker
               |
               ↓
          IndexedDB
               |
               ↓
          PHP API
               |
               ↓
             MySQL
               |
               ↓
      Successful Response
               |
               ↓
       Remove Local Record
```

---

# 16. IndexedDB

When offline functionality has been approved for a feature, use IndexedDB to store pending data locally.

Frontend submission logic should check:

```javascript
navigator.onLine
```

### When Online

The application should:

1. Validate the data.
2. Send the request to the PHP API.
3. Process the server response.
4. Update the interface.

### When Offline

The application should:

1. Validate the data locally where appropriate.
2. Store the pending payload in IndexedDB.
3. Inform the user that the data was saved locally.
4. Keep the record until it can be synchronized.

Offline records should persist through page refreshes and navigation.

---

# 17. Service Worker

When offline functionality has been explicitly approved, create or modify:

```text
/sw.js
```

The Service Worker should use the Cache API to store core static resources needed for offline operation.

Potential cached resources include:

* Core HTML
* CSS
* JavaScript
* Logos
* Icons
* Other safe static assets

Do not blindly cache:

* Sensitive API responses
* Authentication responses
* Private user data
* Database responses
* Other sensitive dynamic content

The Service Worker should clearly distinguish static resources from dynamic application requests.

---

# 18. Service Worker Registration

The Service Worker should be registered from frontend JavaScript.

Example:

```javascript
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log(
                    'Service Worker registered:',
                    registration.scope
                );
            })
            .catch(error => {
                console.error(
                    'Service Worker registration failed:',
                    error
                );
            });
    });
}
```

Prefer centralized registration instead of unnecessarily duplicating registration logic across pages.

---

# 19. HTTPS Requirement for Offline Features

Production Service Worker functionality requires a secure context.

The Z.com production environment must therefore use HTTPS.

Verify:

* Valid SSL/TLS certificate
* HTTP → HTTPS redirection
* HTTPS API requests
* HTTPS authentication
* Secure cookies
* HTTPS transmission of sensitive data
* Service Worker served from HTTPS

Local development may use:

```text
http://localhost
```

because localhost is generally treated as a secure development context by modern browsers.

---

# 20. PHP API Receiver for Offline Synchronization

When offline synchronization is explicitly approved for a feature, use a dedicated PHP API endpoint.

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
* Authenticate requests where required
* Authorize requests where required
* Apply appropriate CSRF protection
* Apply rate limiting where appropriate
* Use prepared SQL statements
* Insert validated data into MySQL
* Return JSON
* Use appropriate HTTP status codes
* Never render HTML

The API must follow all applicable requirements in `SECURITY_RULES.md`.

---

# 21. Offline Synchronization

When explicitly approved, synchronization may occur after network connectivity is restored.

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
Server Validation
       ↓
Database Operation
       ↓
Successful Response?
     /       \
   YES        NO
    ↓          ↓
Delete      Keep Record
Record      for Retry
```

Never delete a local record merely because the request was attempted.

A record should only be removed after the server confirms successful processing.

Failed records should remain available for retry.

---

# 22. Visibility-Aware Polling

The application should use visibility-aware polling for applicable pages.

Polling should use separate intervals depending on whether the page is visible.

## Fast Polling

When the page is visible, use a faster polling interval.

Example:

```javascript
const FAST_INTERVAL = 10000;
```

The exact value should remain configurable.

## Slow Polling

When the page is hidden, use a slower polling interval.

Example:

```javascript
const SLOW_INTERVAL = 60000;
```

The exact value should remain configurable.

---

# 23. Page Visibility API

Use the Page Visibility API:

```javascript
document.visibilityState
```

and:

```javascript
document.addEventListener('visibilitychange', ...)
```

### When Visible

The polling system should:

1. Stop the slow polling timer.
2. Switch to the fast interval.
3. Optionally perform an immediate refresh.
4. Start the fast polling timer.

### When Hidden

The polling system should:

1. Stop the fast polling timer.
2. Switch to the slow interval.
3. Start the slow polling timer.

Never allow multiple polling timers to run simultaneously.

---

# 24. Centralized Polling

Where practical, use a reusable polling utility rather than duplicating polling logic across every page.

A possible location is:

```text
/assets/js/polling.js
```

Individual pages should be able to provide their own data-refresh function while the shared polling utility handles:

* Visibility detection
* Fast polling
* Slow polling
* Timer management
* Preventing duplicate timers
* Refreshing when visibility changes

Do not add polling to pages that do not require periodic data updates.

---

# 25. API Development Rules

Every API endpoint must follow the applicable requirements in `SECURITY_RULES.md`.

APIs should:

* Validate requests
* Validate input
* Authenticate protected operations
* Authorize protected operations
* Use prepared statements
* Return appropriate HTTP status codes
* Return safe responses
* Avoid excessive data exposure
* Apply rate limiting where appropriate
* Apply CSRF protection where applicable
* Avoid exposing internal errors

Never assume an endpoint is safe simply because it is not directly linked from the frontend.

---

# 26. Database Development Rules

Database changes must be deliberate.

Before modifying the database:

1. Determine whether the requested feature actually requires a database change.
2. Modify only the necessary tables/columns/indexes.
3. Preserve existing data where possible.
4. Avoid destructive changes unless explicitly requested.
5. Test database operations locally.
6. Follow all database security requirements in `SECURITY_RULES.md`.

Use prepared statements for database operations.

---

# 27. Authentication and Authorization

Authentication and authorization must follow `SECURITY_RULES.md`.

For protected functionality:

```text
Request
   ↓
Authenticated?
   ↓
Authorized?
   ↓
Valid Request?
   ↓
Perform Action
```

Never rely solely on frontend controls.

Sensitive actions must be checked server-side.

---

# 28. Error Handling

Development and production environments must handle errors differently.

### Development

Detailed debugging information may be available locally.

### Production

Do not expose:

* Database errors
* PHP stack traces
* File paths
* Credentials
* Internal server information
* Debugging information

Production responses should provide safe, user-friendly messages while detailed technical information is logged privately where appropriate.

---

# 29. Dependency Management

Do not add libraries, packages, or frameworks unless they are necessary for the requested functionality.

Before adding a dependency:

1. Determine whether the existing stack can accomplish the task.
2. Determine whether the dependency is actually necessary.
3. Consider its security and maintenance status.
4. Avoid adding duplicate functionality.
5. Keep the dependency updated.

Existing project dependencies should also be maintained and updated when appropriate.

---

# 30. File Upload Development

For any feature involving file uploads, follow all applicable file-upload security rules in `SECURITY_RULES.md`.

Do not assume uploaded files are safe.

Consider:

* Extension validation
* MIME validation
* File size limits
* Filename sanitization
* Randomized filenames
* Content validation
* Executable file restrictions
* Safe upload directories
* Authorization
* Access control

Do not allow uploaded files to execute as server-side code.

---

# 31. Testing Requirements

Every significant change should be tested locally before deployment.

Testing should include:

### Functional Testing

Verify:

* Normal user flow
* Valid inputs
* Expected database operations
* Expected UI behavior
* Expected API responses

### Security Testing

Where applicable, test:

* Invalid input
* Unauthorized requests
* Invalid permissions
* SQL injection attempts
* XSS attempts
* CSRF attempts
* Rate-limit behavior
* Authentication bypass attempts
* Direct API access
* File upload abuse
* Information disclosure

### Offline Testing

Only when offline functionality has been explicitly approved for the feature, test:

* Offline submission
* IndexedDB storage
* Page refresh while offline
* Browser restart where applicable
* Network reconnection
* Synchronization
* Failed synchronization
* Successful synchronization
* Duplicate prevention
* Local record removal after successful synchronization

---

# 32. Production Deployment Testing

Before making the system live on Z.com:

```text
Complete Features
      ↓
Local Functional Testing
      ↓
Security Testing
      ↓
Database Verification
      ↓
Email Testing
      ↓
Production Configuration
      ↓
Deploy to Z.com
      ↓
Production Testing
      ↓
Security Verification
      ↓
Go Live
```

Verify that the production environment does not expose development debugging information.

---

# 33. Final Security Review

Before production deployment, perform a final security review using:

```text
SECURITY_RULES.md
```

Verify that security controls were not accidentally bypassed or weakened during development.

The final review should include:

* Authentication
* Authorization
* Input validation
* SQL injection protection
* XSS protection
* CSRF protection
* Rate limiting
* Session security
* File upload security
* HTTPS
* Security headers
* Error handling
* Secret management
* Database security
* API security
* Logging
* Dependency security
* Backup/recovery
* Security testing

---

# 34. Handling Conflicting Requests

If my prompt conflicts with these rules:

### Security takes priority over convenience.

If my requested implementation would knowingly create a security vulnerability:

1. Do not knowingly implement the insecure approach.
2. Explain the problem.
3. Provide a secure implementation or alternative.
4. Preserve the intended functionality as much as possible.

If the requested change requires a major architectural modification, explain the implications before making unrelated architectural changes.

If the requested change requires offline functionality, follow the explicit offline confirmation rule.

---

# 35. What Must NOT Happen Automatically

Unless explicitly requested or approved, do not automatically:

* Add offline support
* Modify `sw.js`
* Add IndexedDB logic
* Change API submission behavior to support offline queues
* Cache new resources
* Add new libraries
* Add new frameworks
* Redesign unrelated UI
* Refactor unrelated code
* Change unrelated database structures
* Change unrelated APIs
* Change authentication behavior
* Change authorization behavior
* Change existing functionality
* Deploy to Z.com
* Change production configuration

---

# 36. Global Development Workflow

For every feature, follow:

```text
1. Understand the requested feature
        ↓
2. Check PROJECT_RULES.md
        ↓
3. Check SECURITY_RULES.md
        ↓
4. Identify security requirements
        ↓
5. Identify affected components
        ↓
6. Determine whether offline support is relevant
        ↓
7. If offline is relevant → ASK FOR CONFIRMATION
        ↓
8. Implement requested functionality
        ↓
9. Implement applicable security controls
        ↓
10. Test functionality
        ↓
11. Test security
        ↓
12. Review for unintended changes
        ↓
13. Commit to Git
        ↓
14. Continue development
```

---

# 37. Final Global Instruction

**Treat `PROJECT_RULES.md` and `SECURITY_RULES.md` as permanent project instructions.**

Every prompt I make for this project must follow both documents.

Do not require me to repeat the rules.

Always:

* Develop securely by default.
* Make minimal and targeted changes.
* Preserve existing functionality.
* Follow the project's technology stack.
* Follow the security requirements.
* Avoid unnecessary dependencies.
* Avoid unnecessary refactoring.
* Keep secrets out of GitHub.
* Use XAMPP for local development.
* Use Git/GitHub for version control.
* Use Z.com for production deployment.
* Deploy through Git when the project is ready for production.
* Test before deployment.

### Special Offline Rule

**Offline functionality is opt-in.**

Even if the project already contains a Service Worker, IndexedDB, Cache API, and offline infrastructure, do not automatically apply them to future features.

If a requested feature would benefit from offline functionality:

**Explain the required offline changes and WAIT FOR MY EXPLICIT CONFIRMATION before implementing them.**

Do not assume approval.

---

# 38. Core Principle

The project must follow:

```text
SECURE BY DEFAULT
        +
MINIMAL CHANGES
        +
SECURITY WITH FUNCTIONALITY
        +
OFFLINE ONLY WITH EXPLICIT APPROVAL
        +
LOCAL DEVELOPMENT FIRST
        +
GIT/GITHUB VERSION CONTROL
        +
GIT DEPLOYMENT FOR PRODUCTION
        +
TEST BEFORE DEPLOYMENT
```

> **Build securely by default. Make only the changes requested. Follow both project and security rules on every prompt. Never automatically apply offline functionality without explicit approval.**
