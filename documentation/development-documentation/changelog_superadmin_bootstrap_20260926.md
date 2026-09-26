# Change Log: Initial Super Administrator Bootstrap

Date: 2026-09-26

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