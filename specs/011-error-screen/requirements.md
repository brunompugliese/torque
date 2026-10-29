# 011 — Error screen: Requirements

**Status:** Done

## Problem

When a page fails to render, Next shows its default error screen: English text, no Torque style, no way to retry, and no way for the user to tell the project owner what happened. Debugging a user's report means guessing from the time of day in the hosting logs.

## Users

All roles (`owner`, `receptionist`, `mechanic`). Anyone can hit an unexpected error.

## User stories

- As a user, I want a clear Spanish message and a "Reintentar" button when a page fails, so that I can keep working.
- As a user, I want to see an error code I can pass along, so that the person fixing it can find my error.
- As the project owner, I want that code to match the one in the hosting logs, so that I can find the exact failure.

## Acceptance criteria

- [ ] Given a page throws while rendering, when the user opens it, then the app shell (header and navbar) stays and the content area shows the error screen instead of Next's default.
- [ ] Given the error screen, when the user presses "Reintentar", then the segment renders again.
- [ ] Given the error screen, when the user presses "Ir al inicio", then they go to `/inicio`.
- [ ] Given an error with a digest, when the screen shows, then it displays the digest as "Código: <digest>"; given no digest (development), then no code line shows.
- [ ] Given the shell itself fails (root layout), when the user opens any page, then a minimal screen in Spanish with "Reintentar" shows.
- [ ] The error screen is announced to screen readers (`role="alert"`) and moves focus to its title.
- [ ] The screen shows no error message text from the exception, only the generic copy and the digest.

## Out of scope

- Error tracking services, correlation IDs in server logs, audit logs (separate specs if needed).
- Failures inside server actions and list loads: forms and lists already have their own error states.
- A not-found screen.

## Open questions

- None.
