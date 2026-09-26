# Change Log: Local Authentication Foundation

Date: 2026-09-26 04:11:14 (+02:00)

## Scope

Added local email/password sign-in, persistent server-side sessions, logout, and separate authentication and Super Admin authorization checks. This milestone does not add dashboard functionality, organization management, self-registration, password reset, or external identity providers.

## Authentication Flow

1. `GET /login` renders the EJS sign-in page.
2. `POST /login` verifies same-origin submission, applies a per-process IP throttle, loads the user through their `local` `auth_identities` record, and verifies the password with the existing bcryptjs dependency.
3. Only active accounts with a valid password and platform or active organization authorization continue. Super Administrators are redirected to `/admin`; organization members are directed to `/dashboard` for a later milestone.
4. A fresh cryptographically random token is issued in an HttpOnly cookie. The database stores only its SHA-256 digest.
5. `POST /logout` checks request origin, deletes the server-side session, clears the cookie, and redirects to `/login`.

## Session Architecture

The `sessions` table is added through the repeatable `npm run db:init` initializer. It stores the owning user, unique token digest, creation/expiry/last-activity timestamps, and optional bounded user-agent/IP metadata. Sessions expire after eight hours. Activity is updated at most every five minutes. Cookies use `SameSite=Lax` and `HttpOnly`; production uses `Secure` and the `__Host-` prefix. Login issues a new token and invalidates any prior cookie session to prevent fixation.

This design keeps the browser token opaque, supports server-side revocation and future session review, and avoids localStorage, sessionStorage, and JWT browser sessions.

## Authentication and Authorization

`requireAuth` validates the cookie against the session table, reloads the active user, and attaches safe user fields to `req.user`. `requireSuperAdmin` separately queries `user_platform_roles` and `platform_roles` on each protected request; role claims are never trusted from the browser or session cookie. `/admin` is currently a protected test page only.

## Future Identity Providers

Local login uses the existing `users` and `auth_identities` tables. Future Google, Microsoft, OIDC, or SAML providers can add identity records linked to the same user without provider-specific columns on `users`; those providers are not implemented here.

## Development Verification

Run `npm run db:init` to create/verify the sessions table. Run `npm run test:auth` in an interactive terminal to exercise HTTP flows against the development database. The test obtains the active Super Admin email from the database without printing it and asks for the existing password with hidden input. It also creates temporary active/disabled test accounts and removes them at the end. Test output contains only pass/fail descriptions, never credentials or hashes.

## Security Notes

- Failed login messages do not disclose account existence or status.
- The in-process throttle allows ten failed attempts per IP per fifteen-minute window and then expires; it does not lock accounts. For a multi-instance production deployment, move this counter to a shared store.
- Production deployment must use HTTPS. `TRUST_PROXY` is unset by default; configure it only for the actual reverse-proxy topology so forwarded host/protocol/address headers are trusted only when appropriate.
- Password reset, CSRF tokens beyond same-origin and SameSite protections, session administration UI, and external providers remain future work.