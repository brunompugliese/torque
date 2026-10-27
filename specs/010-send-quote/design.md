# 010 — Enviar presupuesto: Design

**Status:** Done
**Requirements:** [requirements.md](requirements.md)

## Summary

A `QuoteButton` in the header row of the job modal's services section builds a WhatsApp link from the job, its services and the shop name. Nothing is stored and nothing is sent by the app. The pure parts (message, URL, availability) are testable functions; the button only renders their result.

## Database

None. `job_list` already returns `enabled`, `vehicle_enabled`, `client_enabled`, the client's name and phone, and the vehicle's plate, brand and model; `getJobDetails` returns the items with their quoted prices and service names.

- Migrations: none.
- RLS impact: none.

## Frontend

- **Placement.** `JobDetailSections` receives the whole `JobListItem` instead of `jobId` and `status`. Its `Section` takes an optional `action` rendered on the right of the heading (`flex items-center justify-between`). The services section passes `QuoteButton` there once the items have loaded. It is a view-mode section, so edit and create never show it; `readOnly` only hides actions elsewhere, so Inicio shows it too.
- **States.** `quoteAvailability(job, items)` returns `{ ok: true }` or `{ ok: false, reason }` with the table order: status, client and phone, services. While the items load the button is disabled with no reason; on error it is not rendered.
- **Enabled, nothing archived.** An `<a target="_blank" rel="noopener noreferrer">` with the accessible name "Enviar presupuesto por mensaje a {name}".
- **Enabled, something archived.** A `<button>` that opens a `ConfirmDialog` listing the archived entities. "Confirmar" calls `window.open(url, "_blank", "noopener")` (allowed: it runs in the click) and closes the dialog.
- **Disabled.** A real `<button disabled>` inside a focusable `<span tabIndex={0}>` that is the tooltip trigger, so the reason shows on mouse hover, keyboard focus and tap. The reason text is also in a visually hidden element linked by `aria-describedby`.
- **Shop name.** The `(app)` layout already calls `getShopName()` for the `TopBar`. It also wraps its children in a small client `ShopNameProvider`; `useShopName()` reads it. One source for the header and the message.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `QuoteButton` | `features/job/components/quote-button.tsx` | New |
| `quoteAvailability`, `QUOTE_STATUSES` (pendiente, presupuesto_enviado, presupuesto_aceptado, cancelado) | `features/job/quote.ts` | New |
| `buildQuoteMessage` | `features/job/quote.ts` | New. Pure; takes the job, the items, the shop name and the `next-intl` translator |
| `toWhatsappUrl(phone, text?)` | `lib/format/whatsapp.ts` | Extended: optional `text` appends `?text=` + `encodeURIComponent(text)` |
| Button classes | `components/shared/whatsapp-button.tsx` | Extended: export the class string so `QuoteButton` shares size, radius and colors |
| `Tooltip` | `components/ui/tooltip.tsx` | New: shadcn (Base UI) tooltip, added with the shadcn CLI |
| `ShopNameProvider`, `useShopName` | `features/shop/shop-name-context.tsx` | New |
| `ConfirmDialog` | `components/shared/confirm-dialog.tsx` | Reused |
| `formatPlate`, `formatMoney`, `calculateTotals` | `lib/format/`, `features/job/total.ts` | Reused |
| `JobDetailSections`, `JobServices` | `features/job/components/` | Extended (props, `action` slot) |

Message template (`jobs.quote.message`, Spanish, voseo; `\n` are real newlines):

```
Hola {client}, te paso el presupuesto para tu {vehicle}:

{lines}

Total: {total}

Cualquier duda avisanos. ¡Gracias!{signature}
```

- `vehicle` = "{brand} {model} ({plate})", plate through `formatPlate`.
- `lines` = one `• {name}[ (x{quantity})]: {line total}` per item, joined with `\n`; the line total is quantity × quoted unit price, summed in cents like `calculateTotals`, and shown with `formatMoney` ("$ 420.000"; decimals only when not zero, which is the app's money format and matches the spec example).
- `signature` = `\n— {shop}` (`jobs.quote.signature`), left out when the shop name is missing.
- The client is the client's `name` column as stored (the surname is separate).

## Validation

None: no input. The phone is already validated when the client is saved; the URL builder keeps the existing digit cleanup and 549 rule.

## UI text

New `jobs.quote` namespace in `messages/es.json`: `button`, `buttonFor` ("Enviar presupuesto por mensaje a {name}"), `reasons.status`, `reasons.client`, `reasons.services`, `message`, `signature`, `archived.title` ("Hay registros archivados"), `archived.job`, `archived.client`, `archived.vehicle`, `archived.question` ("¿Querés enviar el presupuesto igual?"), `archived.confirm` ("Confirmar"). "Cancelar" is the shared `common.cancel`.

## Tests

- RLS (pgTAP): none, no database change.
- Unit (Vitest):
  - `toWhatsappUrl` with and without text; encoding of newlines, bullets and accents.
  - `buildQuoteMessage`: first name, plate spacing, "(xN)" only above 1, line totals, total, quoted never final, archived service plain name, missing shop name, saved order.
  - `quoteAvailability`: each status, no client, no phone, no services, and the order of reasons when several fail.
  - `QuoteButton`: link target, `rel` and name; disabled states with reason in the tooltip and `aria-describedby`; loading; archived dialog lists every archived entity, confirm opens the URL, cancel does nothing.
  - `JobDetailSections`: button next to the heading in editable and read-only views; absent on a load error.

## Risks and alternatives

- **Very long quotes** make a long URL; WhatsApp accepts several thousand characters, which is far beyond a normal job. Not handled.
- **Phone rule.** It is the same first-version Argentina rule as the WhatsApp button (a "15" prefix won't open the right chat); fixing it there fixes both.
- **Tooltip wrapper.** A focusable wrapper lets keyboard users reach the reason, which a bare disabled button would hide. Rejected: native `title` (mouse only, unstyled), reason text beside the button (owner didn't want it), an info icon (a second control on the row).
- **Hex values of the original brief** (#15803d, #f0fdf4, #bbf7d0) are replaced by the existing `--whatsapp` token (owner's decision), which also covers dark mode.
