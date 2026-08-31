# Codex Project Instructions

## 1. Purpose

This file provides instructions for Codex when working on this project.

These instructions apply to every Codex session and every task performed within this repository.

Before making any project changes, Codex must read and follow:

1. `PROJECT_RULES.md`
2. `SECURITY_RULES.md`

These two files are the authoritative project rules.

`PROJECT_RULES.md` defines how the project should be developed, modified, tested, version-controlled, and deployed.

`SECURITY_RULES.md` defines the mandatory security requirements that must be followed throughout development and deployment.

---

## 2. Mandatory Rules

For every task:

1. Read `PROJECT_RULES.md`.
2. Read `SECURITY_RULES.md`.
3. Inspect the existing implementation before modifying it.
4. Understand the user's current request.
5. Identify the smallest set of changes required.
6. Apply all applicable security requirements.
7. Do not modify unrelated functionality.
8. Do not add unrequested features.
9. Do not add unnecessary dependencies.
10. Do not perform unnecessary refactoring.
11. Verify the resulting changes.

The user's current request determines **what** should be changed.

The project rules determine **how** the change must be implemented.

Security requirements must always be followed.

---

## 3. Minimal-Change Requirement

Codex must prefer the smallest reasonable implementation that satisfies the user's request.

Do not:

* Rewrite working code unnecessarily.
* Refactor unrelated code.
* Redesign unrelated UI.
* Modify unrelated database structures.
* Modify unrelated APIs.
* Replace existing libraries without a reason.
* Add unnecessary dependencies.
* Create unnecessary files.
* Change existing behavior that is unrelated to the request.

Preserve existing functionality unless the requested change requires modification.

---

## 4. Offline Functionality Requires Explicit Approval

Offline functionality is strictly opt-in.

The project may contain or eventually contain:

* Service Workers
* Cache API
* IndexedDB
* Offline request queues
* Background synchronization
* Network reconnection synchronization

However, **Codex must never automatically add offline functionality to a feature.**

If a requested change could reasonably involve offline functionality:

1. Identify that offline support is relevant.
2. Explain what offline functionality would require.
3. Identify the affected files/components.
4. Explain any relevant security implications.
5. STOP.
6. Wait for the user's explicit confirmation.
7. Only implement the offline portion after explicit confirmation.

Do not assume approval.

A general request to implement or modify a feature does not automatically authorize offline functionality.

Do not silently:

* Modify `sw.js`.
* Add IndexedDB logic.
* Add Cache API logic.
* Add offline request queues.
* Change online submission logic to support offline requests.
* Add background synchronization.
* Add network-reconnection synchronization.
* Cache additional application resources.

This rule exists to prevent unnecessary modifications and conserve usage limits.

---

## 5. Security

Security must be implemented together with functionality.

Never intentionally choose an insecure implementation merely because it is easier or faster.

Always follow `SECURITY_RULES.md`.

Never expose or commit:

* Passwords
* API keys
* Database credentials
* SMTP credentials
* Application secrets
* Production credentials
* `.env` files
* Other sensitive secrets

---

## 6. Development Environment

The project uses:

* PHP
* HTML
* CSS
* JavaScript
* MySQL
* XAMPP
* Apache
* phpMyAdmin
* PHPMailer
* Git
* GitHub

Local development should primarily use XAMPP.

Z.com is the production hosting environment.

---

## 7. Git Behavior

Git and GitHub are used for version control.

Codex must not automatically create Git commits.

Unless explicitly requested by the user:

* Do not commit changes.
* Do not push changes.
* Do not create or modify Git branches.
* Do not modify remote repository configuration.

Codex may inspect Git status and changes when necessary.

---

## 8. Deployment

Do not deploy to Z.com unless the user explicitly requests deployment-related work.

The intended workflow is:

```text
Local Development
        ↓
Local Testing
        ↓
Git Commit
        ↓
GitHub
        ↓
System Completion
        ↓
Final Testing
        ↓
Configure Z.com Git Deployment
        ↓
Production Configuration
        ↓
Deploy to Z.com
        ↓
Production Testing
        ↓
Live Website
```

Do not establish a manually uploaded production website first and connect Git deployment afterward unless the user explicitly chooses a different workflow.

---

## 9. Before Modifying Files

Before making changes:

1. Inspect relevant files.
2. Read applicable project rules.
3. Read applicable security rules.
4. Determine dependencies.
5. Determine database impact.
6. Determine security impact.
7. Determine whether offline functionality is relevant.
8. If offline functionality is relevant, stop and request explicit approval before implementing it.

Do not make speculative changes.

---

## 10. Testing and Verification

After making changes:

1. Verify the requested functionality.
2. Check for unintended changes.
3. Check applicable security requirements.
4. Verify that secrets were not added to tracked files.
5. Verify that the implementation follows `PROJECT_RULES.md`.
6. Verify that the implementation follows `SECURITY_RULES.md`.

Never claim that something was tested if it was not actually tested.

---

## 11. Final Principle

Always follow this priority:

```text
USER'S CURRENT REQUEST
        +
PROJECT_RULES.md
        +
SECURITY_RULES.md
        ↓
SECURE, MINIMAL, TARGETED IMPLEMENTATION
```

Core principles:

* Secure by default.
* Make only requested changes.
* Preserve existing functionality.
* Follow the existing architecture where practical.
* Keep secrets out of GitHub.
* Use XAMPP for local development.
* Use Git/GitHub for version control.
* Use Z.com for production.
* Do not automatically add offline functionality.
* Require explicit approval before applying offline functionality.
* Do not automatically commit or deploy.
* Test changes before declaring them complete.
