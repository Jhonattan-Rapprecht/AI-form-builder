# Change Log: API Route Organization

Date: 2026-09-26 15:45 (+02:00)

## Summary

Organized API endpoints under the `/api` prefix and added a catch-all 404 handler.

## Changes

- Removed the duplicate `/forms` mount and kept `/api/forms` as the Forms API path.
- Grouped API routes under `/api` to keep the public route structure consistent.
- Added a catch-all handler for unmatched routes.
- Grouped route declarations into named sections for clarity.

## Reasons

- Avoid duplicate entry points for the Forms API.
- Keep API routes discoverable and consistently prefixed.
- Return a response for unknown routes.
- Make the route file easier to maintain.