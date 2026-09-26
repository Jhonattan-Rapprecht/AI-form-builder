# Change Log: Initial Super Administrator Bootstrap

Date: 2026-09-26 03:42:04 (+02:00)

## Purpose

The initial Super Administrator is created through a local operator-run bootstrap command so platform access cannot be claimed through public registration. There is no public Super Administrator registration page.

## Run the Bootstrap

From the project root, run `npm run create-superadmin`. Enter the account email when prompted, then enter and confirm a password of at least 12 characters at the hidden terminal prompts. The password is hashed with bcrypt before it is stored and is never printed.

The command creates an active user, a `local` authentication identity, and a `SUPER_ADMIN` platform-role assignment in one database transaction. It does not create an organization membership.

Running the command again does not create a duplicate Super Administrator or change an existing password. Once the authenticated Super Administrator dashboard exists, additional Super Administrators should be managed there instead of through the bootstrap command.

## Changes

- Added the `npm run create-superadmin` command and its local-only script.
- Added hidden interactive password entry and bcrypt hashing; plaintext passwords and hashes are not printed.
- Enforced and documented the 12-character minimum password length.
- Added transactional creation of an active user, a `local` auth identity, and a `SUPER_ADMIN` platform-role assignment.
- Added duplicate checks, an operator bootstrap lock, and post-insert verification including the absence of organization memberships.
- Added developer documentation describing the bootstrap process and its intended one-time use.

## Scope

- No Express routes, public registration, login flow, authentication middleware, organization membership, or Super Administrator account is created by this change alone.
- No database schema changes were required.