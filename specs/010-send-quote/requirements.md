# 010 — Enviar presupuesto: Requirements

**Status:** Done

## Problem

To send a quote, staff copy the services and prices out of the job modal and retype them in WhatsApp. It is slow and error-prone. The job modal should open the client's chat with the quote already written.

## Users

All roles (`owner`, `receptionist`, `mechanic`), with the same access, on every screen that opens the job modal (Trabajos, Vehículos, Turnos, Inicio).

## User stories

- As a staff member, I want to open the client's WhatsApp chat with the quote already written, so that I don't retype services and prices.
- As a staff member, I want to know why the button is unavailable, so that I know what to fix.
- As a staff member, I want a warning before sending a quote about an archived job, client or vehicle, so that I don't write to the wrong person by accident.

## Acceptance criteria

Shared behavior follows [design.md](../../docs/design.md) (job statuses, formats, accessibility, modals). Where this spec and the docs disagree, the docs win.

Placement and look

- [ ] Given the job modal in view mode (Trabajos, Vehículos, Turnos, Inicio, editable or read only), when the services section shows, then "Enviar presupuesto" is on the same row as the "Servicios" heading, aligned right, in every job state.
- [ ] Given the job modal in edit or create mode, then the button does not show.
- [ ] Given the button, when it renders, then it has a Phosphor paper-plane-tilt icon (regular weight, 16 px, current text color) before the label, and the same size, radius and colors as the shared WhatsApp button (`--whatsapp` token, 10% hover fill, `/40` hover border, 4.5:1 text contrast). No hex values from this spec are used.
- [ ] Given a disabled button, then its text and icon are muted at 70% opacity, with no hover change and the default cursor.

Availability (the first failing row decides the reason)

- [ ] Given a job whose status is not Pendiente, Presupuesto enviado, Presupuesto aceptado or Cancelado, then the button is disabled with the reason "No disponible en este estado". Cancelado is allowed so a rejected quote can be resent after a change.
- [ ] Given a job with no client, or a client with no phone number, then the button is disabled with the reason "Cargá un cliente con teléfono".
- [ ] Given a job with no services, then the button is disabled with the reason "Cargá al menos un servicio".
- [ ] Given the services are still loading, then the button is disabled with no reason. Given they failed to load, then the button is not shown (the section shows its error).
- [ ] Given a disabled button, then it is a real `button` with `disabled`, never a link.

Reason hint

- [ ] Given a disabled button, when the user hovers it, focuses its wrapper with the keyboard or taps it, then a tooltip shows the reason. The reason is also linked to the button with `aria-describedby`.

Message and link

- [ ] Given an enabled button on a job with nothing archived, then it is a link that opens in a new tab with `rel="noopener noreferrer"`, to `https://wa.me/549{phone digits}?text={message}` (same phone cleanup as the shared WhatsApp button), with the message URL-encoded in full. Its accessible name is "Enviar presupuesto por mensaje a {client name}".
- [ ] Given the message, then it is exactly the template in the design, built from the saved job: the client's first name, "{brand} {model} ({plate})" with the plate spaced, one bullet per service in saved order with "(xN)" only when N is greater than 1, the quoted prices only (never the final ones), line totals and the total formatted as the app's money format, and the shop name from the header.
- [ ] Given a service that is archived, then the message uses its plain name, without "(Archivado)".
- [ ] Given the shop name is missing, then the signature line is left out of the message.
- [ ] Given a click on the link, then nothing in the app changes: no status change, no history entry, no toast.
- [ ] Given the job is saved with new services while the modal stays open elsewhere, then the link reflects the saved job the next time the modal renders.

Archived records

- [ ] Given a job, its client or its vehicle is archived, when the button is enabled and the user clicks it, then a confirmation dialog opens listing every archived one ("Este trabajo está archivado.", "El cliente está archivado.", "El vehículo está archivado.") with "Cancelar" and "Confirmar". The control is a `button` in this case, not a link.
- [ ] Given that dialog, when the user confirms, then the WhatsApp chat opens in a new tab with the same URL as above and the dialog closes. When the user cancels, then nothing opens and nothing changes.

Accessibility

- [ ] Given the button, then it is keyboard operable with a visible focus ring, the icon is hidden from screen readers, and the confirmation dialog traps focus and returns it to the button, as the other dialogs do.

## Out of scope

- Marking the quote as sent or changing the job's status (WhatsApp can't confirm delivery; the shop does it by hand).
- Sending anything from the server, templates per shop, or languages other than Spanish.
- Any database change: the job list already exposes the job's, client's and vehicle's archived flags.

## Open questions

- None.
