# 001 — App shell and homepage: Tasks

**Status:** Done
**Design:** [design.md](design.md)

Each task is small, leaves the project working, and says how it is verified. Check it off when done.

- [x] **1. Scaffold Next.js**
  - Do: create the Next.js app (TypeScript, App Router, Tailwind, ESLint, `src/`, npm) in a temporary folder and move it to the repository root, merging `package.json` and `.gitignore`. Enable TypeScript `strict`.
  - Verify: `npm run build` and `npm run lint` pass; existing `supabase/` files unchanged.
- [x] **2. shadcn/ui and theme**
  - Do: install `@phosphor-icons/react`. `npx shadcn init` with Phosphor as `iconLibrary` if supported (otherwise keep the default and note it in `docs/conventions.md`); add `button`. Replace the generated tokens in `globals.css` with the Sand & Teal values from the design, derive the `chart-*` and `sidebar-*` tokens, remove the `.dark` block. Add the `--floating-nav-*` layout variables. Record the derived tokens in `docs/conventions.md`.
  - Verify: `npm run build` passes; a page with a `Button` shows the teal primary on the sand background.
- [x] **3. next-intl**
  - Do: install `next-intl`, add `src/i18n/request.ts` with the fixed `es` locale, `messages/es.json` with the keys from the design, and `NextIntlClientProvider` in the root layout. Set `<html lang="es">`, page metadata and `viewportFit: "cover"`.
  - Verify: `npm run build` passes; a test string renders from `messages/es.json`.
- [x] **4. Vitest**
  - Do: install Vitest, jsdom and React Testing Library; add `vitest.config.ts` and `npm test`. Add the theme token rule test.
  - Verify: `npm test` runs and passes.
- [x] **5. Navigation config**
  - Do: `src/lib/navigation.ts` with `NAV_ITEMS` and `isNavItemActive`, plus their tests.
  - Verify: `npm test` passes.
- [x] **6. Shared components**
  - Do: `TopBar`, `FloatingNav` and `PageHeader` in `src/components/shared/`, plus tests for `TopBar` and `FloatingNav`.
  - Verify: `npm test` passes.
- [x] **7. App layout and pages**
  - Do: `(app)/_components/main-nav.tsx` (`MainNav`); `(app)/layout.tsx` wiring `TopBar`, `<main>` with reserved bottom space and `MainNav`; empty `/`; `/vehiculos`, `/clientes`, `/turnos`, `/trabajos` with `PageHeader`.
  - Verify: `npm run build` passes; in `npm run dev`, every bar item navigates and highlights correctly, and the manual checks in the design (360px and desktop, scrolling, labels fitting, keyboard focus) pass. For the scroll check, temporarily add tall content to a page and remove it afterwards.
- [x] **8. CI**
  - Do: add `.github/workflows/frontend.yml` running `npm ci`, `npm run lint`, `npm test` and `npm run build` on pull requests.
  - Verify: the workflow passes on the PR.
- [x] **9. Docs**
  - Do: update `docs/architecture.md` (frontend status, route group, actual structure), `CLAUDE.md` status line and commands (`npm run dev`, `npm test`), and set this spec's statuses to `Done`.
  - Verify: docs match the implemented behavior.
