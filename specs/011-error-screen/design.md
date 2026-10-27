# 011 — Error screen: Design

**Status:** Done
**Requirements:** [requirements.md](requirements.md)

## Summary

Two Next error boundaries. `src/app/(app)/error.tsx` replaces the content area inside the app shell and `src/app/global-error.tsx` covers the root layout. Both render a shared `ErrorScreen` component styled like the existing list error card (`ListError`): a bordered card, centered text, a primary and a secondary button.

## Database

None.

- Migrations: none
- RLS impact: none

## Frontend

**Layout of the screen** (content area, centered, same width rules as other pages):

```
┌──────────────────────────────────────────┐
│                  (icon)                  │   Phosphor WarningCircle, 40px, secondary text
│        Algo salió mal                    │   18px semibold
│  No pudimos mostrar esta pantalla.       │   14px, secondary text
│  Probá de nuevo; si sigue igual,         │
│  avisanos con el código.                 │
│                                          │
│        [ Reintentar ] [ Ir al inicio ]   │   primary + outline buttons
│                                          │
│        Código: 3849201746                │   12px, secondary text, selectable
└──────────────────────────────────────────┘
```

- Card: white surface, 1px border, 12px radius, 48px vertical padding (same as `ListError`). No shadow.
- "Reintentar" calls Next's `reset`. "Ir al inicio" is a link to `/inicio` styled as a button.
- The code line only shows when the error has a `digest`.
- Focus moves to the title on mount so keyboard and screen reader users land on it. The container has `role="alert"`.
- `global-error.tsx` replaces the whole document, so the shell and theme are missing: it renders its own `<html lang="es">`, imports `globals.css`, and shows the same card with only "Reintentar". Its text is a constant (next-intl is not available there).
- The exception's message is never rendered: it can contain data.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `ErrorScreen` (title, hint, code, actions) | `src/components/shared/error-screen.tsx` | New, generic |
| `error.tsx` | `src/app/(app)/error.tsx` | New |
| `global-error.tsx` | `src/app/global-error.tsx` | New |
| `Button` | `src/components/ui/button.tsx` | Reused |
| Card look | `ListError` in `src/components/shared/list-states.tsx` | Reused as a visual reference; `ErrorScreen` is separate because it has a different layout and is not tied to a list |

Next's error file conventions must be read in `node_modules/next/dist/docs/` before implementing (this Next version may differ).

## Validation

None.

## UI text

New namespace `errorScreen` in `messages/es.json`:

| Key | Text |
|---|---|
| `title` | Algo salió mal |
| `hint` | No pudimos mostrar esta pantalla. Probá de nuevo; si sigue igual, avisanos con el código. |
| `hintNoCode` | No pudimos mostrar esta pantalla. Probá de nuevo en un momento. |
| `retry` | Reintentar |
| `home` | Ir al inicio |
| `code` | Código: {code} |

## Tests

- RLS (pgTAP): none.
- Unit (Vitest): `ErrorScreen` renders title and both actions; shows the code only when given; "Reintentar" calls the callback; moves focus to the title; never renders an error message. `error.tsx` passes the digest through and calls `reset`.

## Risks and alternatives

- A boundary only catches render errors below it. Errors thrown by the root layout need `global-error.tsx`, which is why it exists.
- `global-error.tsx` cannot use `next-intl`; its Spanish text lives as constants. Accepted: it is a last resort and shows two lines.
- Alternative: show the exception message to help debugging. Rejected: messages can leak data and Next hides them in production anyway.
- Alternative: a tracker such as Sentry now. Deferred: adds a dependency and a data-handling decision, and is outside this spec.
