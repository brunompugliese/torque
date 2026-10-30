# 014 — UI adjustments: Design

**Status:** Done
**Requirements:** [requirements.md](requirements.md)

## Summary

Four independent fixes, no database changes (RLS impact: none).

## Frontend

- **Backdrop:** Base UI skips the backdrop of a dialog nested in another one. `DialogOverlay` and `AlertDialogOverlay` pass `forceRender`, so every confirmation blurs the page.
- **Status history:** `STATUS_DOT_CLASS` (in `status-badge.tsx`) maps each status family to its `--status-*-dot` token; `StatusTimeline` entries take an optional `dotClassName`; `JobStatusHistory` renders the status as plain text.
- **Clientes search:** the page is wrapped in `ListSearchProvider` and `ClientsList` renders its first page with no search, like `VehiclesList`. The rule is in [architecture.md](../../docs/architecture.md#sensitive-data) ("Never in URLs").
- **Header link:** `TopBar` wraps the logo, name and byline in one `Link` to `HOME_PATH`, stretched to the bar's height.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `DialogOverlay`, `AlertDialogOverlay` | `components/ui/` | Extended |
| `StatusTimeline`, `STATUS_DOT_CLASS` | `components/shared/` | Extended |
| `ListSearchProvider` | `components/shared/` | Reused |
| `TopBar` | `components/shared/top-bar.tsx` | Extended |

## Validation

Vitest: top bar link, Clientes search not in the URL (reaches the action, clear from the empty state). Visual checks (blur, dots) are manual.
