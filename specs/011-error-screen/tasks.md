# 011 — Error screen: Tasks

**Status:** Done
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Messages**
  - Do: add the `errorScreen` namespace to `messages/es.json`.
  - Verify: `npm test` and `npm run lint` pass.
- [x] **2. ErrorScreen component**
  - Do: build `src/components/shared/error-screen.tsx` with its Vitest tests.
  - Verify: tests cover title, actions, optional code, retry callback, focus and no message text.
- [x] **3. App error boundary**
  - Do: add `src/app/(app)/error.tsx` using `ErrorScreen` with `error.digest` and `reset`.
  - Verify: with `npm run build` and `npm start`, a throwing page shows the screen inside the shell; "Reintentar" and "Ir al inicio" work.
- [x] **4. Global error boundary**
  - Do: add `src/app/global-error.tsx` with Spanish constants and its own `<html>`.
  - Verify: a throwing root layout (temporary) shows the minimal screen; remove the temporary change.
- [x] **5. Cleanup**
  - Do: delete the temporary `src/app/(app)/prueba/` route.
  - Verify: `npm run build` lists no `/prueba` route.
- [x] **6. Docs**
  - Do: add the error screen to the shared patterns in `docs/design.md`; set spec statuses to `Done`.
  - Verify: docs match the implemented behavior.
