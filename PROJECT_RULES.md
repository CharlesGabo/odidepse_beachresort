# Project Development Rules

## 1. Purpose

This document contains the global development rules for this project.

These rules apply to every:

* Feature
* Modification
* Bug fix
* Refactor
* Optimization
* Database change
* UI change
* API change
* Code change
* Configuration change
* Deployment-related change

The project also contains:

```text
SECURITY_RULES.md
```

`SECURITY_RULES.md` contains the mandatory security requirements.

Both documents must be followed for every applicable development task.

---

# 2. Technology Stack

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

* Feature development
* Functional testing
* Database testing
* PHP testing
* JavaScript testing
* Email testing
* Security testing
* Approved offline functionality testing

The production Z.com environment should not be used as the primary development environment.

---

# 4. Master Development Rule

Implement only what the current user request requires while following:

* `PROJECT_RULES.md`
* `SECURITY_RULES.md`

Do not automatically:

* Add unrelated features.
* Refactor unrelated code.
* Redesign unrelated interfaces.
* Modify unrelated database structures.
* Modify unrelated APIs.
* Add unnecessary dependencies.
* Change existing functionality without a reason.
* Apply offline functionality without explicit approval.

Keep changes targeted and minimal.

---

# 5. Development Process

For every development task, follow this general process:

```text
User Request
     ↓
Understand Requirement
     ↓
Inspect Existing Implementation
     ↓
Read Project Rules
     ↓
Read Security Rules
     ↓
Identify Affected Components
     ↓
Identify Security Requirements
     ↓
Identify Required Dependencies
     ↓
Determine Whether Offline Support Is Relevant
     ↓
If Offline Is Relevant → STOP AND REQUEST APPROVAL
     ↓
Implement Requested Functionality
     ↓
Apply Security Controls
     ↓
Test Functionality
     ↓
Test Security
     ↓
Review Changes
```

Do not require the user to repeat these rules in every prompt.

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
* Avoid replacing working implementations without a reason.

If an existing implementation works and does not conflict with the requested change or security requirements, do not unnecessarily replace it.

---

# 7. Unrequested Features

Do not implement features merely because they may be useful.

Examples include:

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
* Additional analytics
* Additional automation
* Offline functionality

If an unrequested feature would be useful, mention it separately rather than implementing it automatically.

---

# 8. Environment Configuration

Environment-specific and sensitive configuration must be stored outside tracked source code.

Use:

```text
.env
```

for environment-specific configuration and secrets.

Use:

```text
.env.example
```

as a safe template containing placeholders only.

The `.env` file must never be committed to GitHub.

The `.env` file may contain:

* Database credentials
* SMTP credentials
* Application secrets
* API keys
* Environment-specific configuration

Never hard-code production credentials into:

* PHP
* JavaScript
* HTML
* CSS
* SQL
* Configuration files
* Other files intended to be committed to GitHub

---

# 9. Git and GitHub

Git and GitHub are used for version control throughout development.

The normal development workflow is:

```text
XAMPP
  ↓
Develop
  ↓
Test Locally
  ↓
Review Changes
  ↓
Git Commit
  ↓
Git Push
  ↓
GitHub
```

Use meaningful commit messages.

Do not commit:

* `.env`
* Passwords
* API keys
* SMTP credentials
* Database credentials
* Private secrets
* Sensitive production configuration

Normally tracked:

```text
PROJECT_RULES.md
SECURITY_RULES.md
AGENTS.md
.env.example
Source Code
```

Normally not tracked:

```text
.env
```

Codex must not automatically create commits or push to GitHub unless explicitly requested.

---

# 10. Deployment and Production Workflow

The system should be developed locally first.

Do not deploy an unfinished system merely to establish a live website.

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

Git deployment does not need to be configured during early development.

Git/GitHub version control should be used during development.

Z.com Git deployment should be configured when the project is approaching production deployment.

---

# 11. Z.com Production Environment

When preparing for production deployment, configure the Z.com environment separately from the local XAMPP environment.

Where applicable, production configuration should include:

* Production `.env`
* Production MySQL database
* Dedicated production database user
* Production PHPMailer/SMTP configuration
* HTTPS/SSL
* Production PHP configuration
* Secure file permissions
* Secure upload directories
* Production error handling
* Security headers
* Production session/cookie settings
* Database backups

The production `.env` must never be copied into GitHub.

---

# 12. Local and Production Environments

Local and production environments may use different configuration values.

## Local

```text
XAMPP
localhost
Local MySQL
Local database credentials
Development email configuration
Development settings
```

## Production

```text
Z.com
HTTPS
Production MySQL
Production database credentials
Production email configuration
Production settings
```

Application code should use environment configuration instead of hard-coded environment-specific values.

---

# 13. Offline Functionality — Explicit Confirmation Required

Offline functionality is opt-in for individual features.

The project may support:

* Service Workers
* Cache API
* IndexedDB
* JavaScript
* PHP API endpoints
* MySQL
* Background synchronization
* Network reconnection synchronization

## CRITICAL RULE

Never automatically add offline functionality to a new or modified feature.

For every future prompt:

1. Determine whether offline functionality is relevant.
2. If offline functionality is not relevant, implement the request normally.
3. If offline functionality is relevant, identify the required offline changes.
4. Explain which files/components would be modified.
5. Explain any relevant security considerations.
6. **STOP.**
7. Wait for the user's explicit confirmation.
8. Only implement the offline portion after explicit confirmation.

Do not assume approval.

A request to implement or modify a feature does not automatically authorize offline functionality.

Do not silently:

* Add IndexedDB.
* Modify `sw.js`.
* Add Cache API logic.
* Queue requests.
* Modify submission logic for offline use.
* Add background synchronization.
* Add reconnection synchronization.
* Cache additional resources.

This rule exists to prevent unnecessary changes and conserve usage limits.

---

# 14. Offline Feature Architecture

Only use the following architecture after explicit approval for the relevant feature.

General architecture:

```text
USER SUBMITS DATA
        ↓
Connectivity Check
        ↓
Attempt Normal API Request
        ↓
Server Request Successful?
      /       \
    YES        NO
     ↓          ↓
   MySQL    Determine Whether
             Failure Is Network-Related
                    ↓
             Store in IndexedDB
                    ↓
             Network Restored
                    ↓
             Synchronization
                    ↓
                PHP API
                    ↓
               Server Validation
                    ↓
                 MySQL
                    ↓
              Successful Response
                    ↓
             Remove Local Record
```

`navigator.onLine` may be used as an initial connectivity indicator, but it must not be treated as definitive proof that the application's server/API is reachable.

The actual network request and server response should determine whether communication succeeded.

---

# 15. IndexedDB

When offline functionality has been explicitly approved for a feature, IndexedDB may be used to store pending records locally.

Frontend logic may use:

```javascript
navigator.onLine
```

as an initial connectivity hint.

## When Online

The application should:

1. Validate the data.
2. Send the request to the PHP API.
3. Process the server response.
4. Update the interface.

## When Offline

The application should:

1. Validate the data locally where appropriate.
2. Store the pending payload in IndexedDB.
3. Inform the user that the data was saved locally.
4. Keep the record until synchronization succeeds.

Offline records should persist through page refreshes and navigation where appropriate.

Do not store sensitive information in IndexedDB unless there is a documented security justification and appropriate protection.

---

# 16. Service Worker

When offline functionality has been explicitly approved, create or modify:

```text
/sw.js
```

The Service Worker should use the Cache API for safe static resources required for offline operation.

Potential resources include:

* Core HTML
* CSS
* JavaScript
* Logos
* Icons
* Other safe static assets

Do not blindly cache:

* Authentication responses
* Private user data
* Sensitive API responses
* Database responses
* Personalized dynamic content
* Other sensitive information

The Service Worker must clearly distinguish static resources from dynamic application requests.

---

# 17. Service Worker Registration

When approved, the Service Worker should be registered through frontend JavaScript.

Prefer centralized registration instead of unnecessarily duplicating registration logic across multiple pages.

The Service Worker should use the appropriate scope for the application.

Do not register or modify Service Worker behavior merely because a new feature was added.

---

# 18. HTTPS Requirement for Offline Features

Production Service Worker functionality requires a secure context.

The Z.com production environment must use HTTPS.

Verify:

* Valid SSL/TLS certificate
* HTTP → HTTPS redirection
* HTTPS API requests
* HTTPS authentication
* Secure cookies
* HTTPS transmission of sensitive data
* Service Worker served through HTTPS

Local development may use:

```text
http://localhost
```

because localhost is generally treated as a secure development context by modern browsers.

---

# 19. PHP API Receiver for Offline Synchronization

When offline synchronization has been explicitly approved, use a dedicated PHP API endpoint where appropriate.

Example:

```text
/api/receiver.php
```

The endpoint must:

* Accept the intended HTTP method only.
* Accept raw JSON where specified.
* Validate `Content-Type`.
* Decode JSON safely.
* Validate required fields.
* Validate data types.
* Validate allowed values.
* Perform server-side validation.
* Authenticate protected requests.
* Authorize protected operations.
* Apply CSRF protection where applicable.
* Apply rate limiting where appropriate.
* Use prepared SQL statements.
* Perform the required database operation.
* Return JSON.
* Use appropriate HTTP status codes.
* Never render HTML.

Offline synchronization must not bypass the application's authentication, authorization, CSRF protection, or other security controls.

The authentication mechanism for background synchronization must be compatible with the application's existing security architecture.

Do not weaken security merely to make background synchronization easier.

---

# 20. Offline Synchronization

When explicitly approved, synchronization may occur after network connectivity is restored.

General process:

```text
Network Restored
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

Never delete a local record merely because a request was attempted.

A local record should only be removed after the server confirms successful processing.

Failed records should remain available for retry.

Synchronization should account for duplicate submissions and should use an appropriate idempotency or duplicate-prevention strategy where necessary.

---

# 21. Visibility-Aware Polling

All pages that perform periodic data refreshing should use visibility-aware polling.

Pages that do not require periodic data refreshing should not receive polling merely to satisfy this rule.

Use separate intervals for visible and hidden pages.

## Fast Polling

When the page is visible, use a faster refresh interval.

Example:

```javascript
const FAST_INTERVAL = 10000;
```

The exact value should remain configurable.

## Slow Polling

When the page is hidden, use a slower refresh interval.

Example:

```javascript
const SLOW_INTERVAL = 60000;
```

The exact value should remain configurable.

---

# 22. Page Visibility API

Use the Page Visibility API:

```javascript
document.visibilityState
```

and:

```javascript
document.addEventListener('visibilitychange', ...)
```

## When Visible

The polling system should:

1. Stop the slow polling timer.
2. Switch to the fast interval.
3. Optionally perform an immediate refresh.
4. Start the fast polling timer.

## When Hidden

The polling system should:

1. Stop the fast polling timer.
2. Switch to the slow interval.
3. Start the slow polling timer.

Never allow multiple polling timers to run simultaneously.

Avoid unnecessary polling when the browser is offline.

---

# 23. Centralized Polling

Where practical, use a reusable polling utility rather than duplicating polling logic across pages.

A possible location is:

```text
/assets/js/polling.js
```

Individual pages should provide their own data-refresh function while the shared utility handles:

* Visibility detection
* Fast polling
* Slow polling
* Timer management
* Duplicate timer prevention
* Visibility changes
* Optional immediate refresh

Do not add polling to pages that do not require periodic data updates.

---

# 24. API Development Rules

Every API endpoint must follow the applicable requirements in `SECURITY_RULES.md`.

APIs should:

* Validate requests.
* Validate input.
* Authenticate protected operations.
* Authorize protected operations.
* Use prepared statements.
* Return appropriate HTTP status codes.
* Return safe responses.
* Avoid excessive data exposure.
* Apply rate limiting where appropriate.
* Apply CSRF protection where applicable.
* Avoid exposing internal errors.
* Never assume an endpoint is safe merely because it is not directly linked from the frontend.

---

# 25. Database Development Rules

Database changes must be deliberate.

Before modifying the database:

1. Determine whether the requested feature actually requires a database change.
2. Modify only the necessary tables, columns, constraints, or indexes.
3. Preserve existing data where possible.
4. Avoid destructive changes unless explicitly requested.
5. Test database operations locally.
6. Follow all database security requirements in `SECURITY_RULES.md`.

Use prepared statements for database operations.

---

# 26. Authentication and Authorization

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

# 27. Error Handling

Development and production environments must handle errors differently.

## Development

Detailed debugging information may be available locally when appropriate.

## Production

Do not expose:

* Database errors
* PHP stack traces
* File paths
* Credentials
* Internal server information
* Debugging information

Production responses should provide safe user-facing messages.

Detailed technical information should be logged privately where appropriate.

---

# 28. Dependency Management

Do not add libraries, packages, or frameworks unless they are necessary for the requested functionality.

Before adding a dependency:

1. Determine whether the existing stack can accomplish the task.
2. Determine whether the dependency is necessary.
3. Consider its security and maintenance status.
4. Avoid duplicate functionality.
5. Keep dependencies appropriately maintained.

Do not replace an existing dependency without a technical reason.

---

# 29. File Upload Development

For features involving file uploads, follow all applicable file-upload security requirements in `SECURITY_RULES.md`.

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

Never allow uploaded files to execute as server-side code.

---

# 30. Testing Requirements

Every significant change should be tested locally before deployment.

## Functional Testing

Verify:

* Normal user flow
* Valid inputs
* Invalid inputs
* Expected database operations
* Expected UI behavior
* Expected API responses

## Security Testing

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

## Offline Testing

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

# 31. Production Deployment Testing

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

# 32. Final Security Review

Before production deployment, perform a final security review using:

```text
SECURITY_RULES.md
```

Verify that security controls were not accidentally bypassed or weakened.

---

# 33. Handling Conflicting Requests

If a user request conflicts with a security requirement:

1. Do not knowingly implement the insecure approach.
2. Explain the security issue.
3. Provide or implement a secure alternative where possible.
4. Preserve the requested functionality as much as reasonably possible.

If the requested change requires a major architectural modification, explain the implications before making unrelated architectural changes.

If the requested change requires offline functionality, follow the explicit offline confirmation rule.

---

# 34. Changes That Must Not Happen Automatically

Unless explicitly requested or approved, do not automatically:

* Add offline support.
* Modify `sw.js`.
* Add IndexedDB logic.
* Change API submission behavior to support offline queues.
* Cache new resources.
* Add new libraries.
* Add new frameworks.
* Redesign unrelated UI.
* Refactor unrelated code.
* Change unrelated database structures.
* Change unrelated APIs.
* Change authentication behavior.
* Change authorization behavior.
* Change existing functionality.
* Deploy to Z.com.
* Change production configuration.
* Commit to Git.
* Push to GitHub.

---

# 35. Global Development Workflow

For every feature:

```text
1. Understand the requested feature
        ↓
2. Inspect existing implementation
        ↓
3. Check PROJECT_RULES.md
        ↓
4. Check SECURITY_RULES.md
        ↓
5. Identify security requirements
        ↓
6. Identify affected components
        ↓
7. Determine whether offline support is relevant
        ↓
8. If offline is relevant → ASK FOR CONFIRMATION
        ↓
9. Implement requested functionality
        ↓
10. Implement applicable security controls
        ↓
11. Test functionality
        ↓
12. Test security
        ↓
13. Review for unintended changes
        ↓
14. Report changes and testing results
```

Git commits and deployment remain user-controlled unless explicitly requested.

---

# 36. Core Principle

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

> Build securely by default. Make only the changes requested. Preserve existing functionality. Follow both project and security rules. Never automatically apply offline functionality without explicit approval.
