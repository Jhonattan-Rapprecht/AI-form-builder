# Change Log: Super Admin Login Email Validation

Date: 2026-09-26 05:05:48 (+02:00)

## Issue

The initial Super Admin login email used an underscore in the domain portion (after `@`). The browser's native `type="email"` validation rejected it before submitting the form, even though the terminal HTTP integration test could authenticate it. The login page was therefore not reaching the server.

## Resolution

- Updated the existing Super Admin `users.email` and matching `local` `auth_identities.provider_subject` / `provider_email` to the user-approved address `superuser@ai-formbuilder.com` in one transaction.
- Verified all identity fields match; the existing password and password hash were not changed.
- Tightened bootstrap email validation so future email domains must contain valid DNS-style labels and cannot contain underscores.

## Verification Notes

The proposed address uses a hyphen in its domain, which is syntactically valid for the browser email field. Sign in at `/login` with `superuser@ai-formbuilder.com` and the existing password. Passwords are not recorded in this changelog.
