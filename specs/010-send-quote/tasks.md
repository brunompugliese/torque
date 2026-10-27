# 010 — Enviar presupuesto: Tasks

**Status:** Done
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. URL builder and shop name**
  - Do: `text` parameter in `toWhatsappUrl`; `ShopNameProvider` and `useShopName` in `features/shop/`, mounted in the `(app)` layout with the name `getShopName()` already returns.
  - Verify: Vitest for the URL with and without text; the provider returns the name and `undefined` without one; `npm test` passes.
- [x] **2. Quote logic**
  - Do: `features/job/quote.ts` with `QUOTE_STATUSES`, `quoteAvailability` and `buildQuoteMessage`; `jobs.quote` keys in `messages/es.json`.
  - Verify: Vitest for every case listed in the design, including the reason order and the exact message from the spec example.
- [x] **3. Tooltip and shared button classes**
  - Do: add the shadcn `tooltip`; export the WhatsApp button's class string from `whatsapp-button.tsx`.
  - Verify: existing `whatsapp-button` tests still pass; `theme-tokens.test.ts` still passes.
- [x] **4. QuoteButton**
  - Do: `QuoteButton` with the link, disabled (wrapper, tooltip, `aria-describedby`) and archived-confirmation variants.
  - Verify: Testing Library tests for each state, the accessible names, focus return from the dialog, and `window.open` on confirm.
- [x] **5. Wire into the job modal**
  - Do: `JobDetailSections` takes the `JobListItem` and an `action` slot on `Section`; update `use-job-modal.tsx`; the button shows once the items load and not on error.
  - Verify: tests on Trabajos, a vehicle's job history and Inicio (read only); `npm run lint` and `npm run build` pass.
- [x] **6. Docs**
  - Do: add the button, its states and the message template to the job section of `docs/design.md`; list the new shared pieces (`Tooltip`, `ShopNameProvider`, `toWhatsappUrl` text) in `docs/architecture.md`; set spec statuses to `Done`.
  - Verify: docs match the implemented behavior.
