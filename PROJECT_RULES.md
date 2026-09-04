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
* Bootstrap (downloaded locally, not via CDN)
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

Environment-specific and sensitive configuration must be stored outside tracked source code using `.env`. Never commit `.env` or hard-code credentials. 

For full environment and secret management rules, strictly adhere to **Section 3: Secret Management** and **Section 4: Git Security** in `SECURITY_RULES.md`.

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

Every API endpoint must strictly adhere to the requirements in **Section 13: API Security** and **Section 14: JSON API Security** in `SECURITY_RULES.md`. Do not bypass these security checks for any API endpoint.

---

# 25. Database Development Rules

Database changes must be deliberate.

1. Determine whether the requested feature actually requires a database change.
2. Modify only the necessary tables, columns, constraints, or indexes.
3. Preserve existing data where possible.
4. Avoid destructive changes unless explicitly requested.
5. Test database operations locally.

For all database interactions, you must rigidly follow **Section 5: Database Security** in `SECURITY_RULES.md` (e.g., using prepared statements).

---

# 26. Authentication and Authorization

Authentication and authorization checks must be performed server-side.

For full authentication and authorization rules, strictly adhere to **Section 8: Authentication** and **Section 9: Authorization** in `SECURITY_RULES.md`.

---

# 27. Error Handling

Do not expose database errors, stack traces, paths, or credentials in production.

For full error handling requirements, strictly adhere to **Section 18: Error Handling** in `SECURITY_RULES.md`.

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

Features involving file uploads must strictly adhere to all guidelines in **Section 16: File Upload Security** found within `SECURITY_RULES.md`. Ensure you review that section before implementing any upload functionality.

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

If a user request conflicts with a security requirement, you must follow the conflict resolution steps outlined in **Section 37: Security Conflict Rule** in `SECURITY_RULES.md`.

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

---

# 37. Mobile Responsiveness Implementation Rules

These constraints override all other implementation guidance when addressing responsive or mobile styling issues.

### 1. Treat Existing Behavior as Read-Only

All application behavior is frozen.

Do not change, refactor, simplify, optimize, reorganize, or "fix" any existing:

* PHP business logic
* JavaScript logic
* event handlers
* AJAX/fetch requests
* API calls
* form submission behavior
* validation
* authentication/session handling
* permissions
* redirects
* routing
* database queries
* calculations
* filtering/sorting logic
* table data generation
* chart data
* scanner/barcode logic
* attendance logic
* PDF generation logic
* offline synchronization/queue logic
* iframe communication
* timers
* callbacks
* conditional business logic

Even if existing logic appears incorrect, leave it unchanged.

---

### 2. CSS First

For every responsive issue, attempt to solve it in this order:

1. Existing stylesheet
2. Component/page stylesheet
3. Responsive media query
4. Existing markup class adjustment
5. Minimal presentation-only inline style adjustment

JavaScript or PHP logic must NOT be used to calculate responsive layouts when CSS can solve the problem.

Prefer CSS-only fixes wherever possible.

---

### 3. JavaScript Modification Restrictions

Do not modify JavaScript unless a responsive presentation issue genuinely cannot be fixed through CSS or markup classes.

If JavaScript must be modified, permitted changes are limited to presentation-only operations such as:

* adding/removing a CSS class solely for presentation;
* changing a presentation-only class string;
* changing embedded CSS/style values;
* adding presentation-only wrapper markup generated by JavaScript.

Do NOT alter:

* conditions
* loops
* function behavior
* function arguments
* return values
* event listeners
* handler execution
* asynchronous behavior
* API calls
* data transformations
* state mutations
* DOM IDs used as hooks
* selectors relied upon by existing functionality

If a JavaScript change would require touching behavioral logic, leave the responsive issue unresolved and report it instead.

---

### 4. PHP Modification Restrictions

PHP files may be edited only where they contain frontend templates/markup.

Within PHP templates, responsive changes must be limited to:

* CSS classes
* presentation wrappers
* responsive markup attributes
* stylesheet references/cache-busting values when necessary

Do NOT modify PHP expressions, conditions, loops, queries, variables, sessions, includes, request processing, authentication, authorization, validation, or backend behavior.

If PHP and HTML are mixed on the same line, avoid rewriting the PHP expression solely for formatting purposes.

---

### 5. Preserve DOM Hooks

Do not rename, remove, duplicate, or repurpose existing:

* `id` attributes
* `name` attributes
* `data-*` attributes
* form field names
* element values
* JavaScript selectors
* classes that are known/suspected to be used by JavaScript
* iframe identifiers
* modal identifiers
* Bootstrap JS hooks
* ARIA relationships

New presentation-only classes may be added.

---

### 6. Do Not Change Content to Make It Fit

Do not solve responsive problems by:

* removing content
* shortening labels
* renaming buttons
* hiding features
* hiding table columns
* removing actions
* removing form fields
* removing navigation items
* truncating important information
* changing displayed values

Fix the layout instead.

Text wrapping, ellipsis for already-noncritical decorative text, and scoped scrolling are acceptable when appropriate.

---

### 7. No Global Overflow Masking

Do not add global rules such as:

```css
html,
body {
    overflow-x: hidden;
}
```

as a substitute for fixing overflowing components.

Find the element producing the overflow and correct that element.

---

### 8. No Unrelated Refactoring

Do not:

* rename variables
* rename functions
* reorganize components
* restructure PHP
* rewrite JavaScript
* convert coding styles
* reorganize CSS unrelated to responsiveness
* change architecture
* upgrade dependencies
* modify vendor files
* run repository-wide auto-formatting
* remove "unused" code
* fix unrelated warnings
* fix unrelated functional bugs

Keep every diff focused on responsive presentation.

---

### 9. Desktop Regression Protection

Existing desktop layouts at 1024px and above should remain as visually close to the current implementation as possible.

Do not redesign working desktop interfaces just to make responsive CSS easier.

Prefer breakpoint-specific overrides for mobile/tablet.

---

### 10. Data Safety During Testing

Testing must be non-destructive.

Do not:

* create test users unless explicitly authorized;
* modify real account data;
* delete records;
* submit destructive actions;
* alter attendance records;
* change inventory/rental records;
* change permissions;
* reset passwords;
* modify production-like application data solely for responsive testing.

Use existing safe/read-only states where available.

If a UI state cannot safely be reached, report it as unverified instead of modifying application data.

---

### 11. Cache Busting

Only change stylesheet cache-busting query strings for stylesheets that were actually modified and only when the repository already uses this mechanism.

Do not introduce a new cache-busting system.

Do not change JavaScript cache versions unless the corresponding JavaScript file actually required an approved presentation-only modification.

---

### 12. Final Diff Gate

Before completing the task, inspect every modified file and every changed hunk.

For each changed hunk, ask:

> Is this exact change required for responsive/mobile presentation?

If not, revert it.

Additionally verify that the final diff contains no intentional modifications to:

* business logic
* backend processing
* queries
* APIs
* validation
* routing
* permissions
* application state
* event handling
* data transformations
* feature behavior

If uncertain whether a change could affect functionality, revert it and report the responsive issue instead of taking the risk.

### Final Principle

When choosing between:

A. leaving a minor responsive issue unresolved, or
B. modifying existing functionality to solve it,

always choose **A**.

Preserving application behavior has higher priority than achieving perfect responsive coverage.
