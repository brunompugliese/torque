# 001 — App shell and homepage: Design

**Status:** Done
**Requirements:** [requirements.md](requirements.md)

## Summary

Scaffold the Next.js app at the repository root with shadcn/ui, Tailwind, `next-intl` and Vitest, following the structure in [architecture.md](../../docs/architecture.md#planned-structure). Apply the Sand & Teal palette as CSS variables. Build three generic shared components (top bar, floating bottom navigation, page header), wire them in one layout used by every app page, and add the homepage plus four empty section pages.

## Database

None.

- Migrations: none.
- RLS impact: none. No page reads data in this spec.

## Frontend

### Stack setup

- Next.js (latest stable, App Router, TypeScript strict, `src/` directory, ESLint) created at the repository root. The existing `package.json` (Supabase CLI and `supabase-js`) is merged, not replaced. The existing `supabase/`, `docs/` and `specs/` folders are untouched.
- Tailwind CSS v4 and shadcn/ui (`npx shadcn init`), base color replaced by the palette below.
- `next-intl` without i18n routing: a single `es` locale set in `src/i18n/request.ts`, no locale segment in URLs. `<html lang="es">`.
- Font: Geist through `next/font`, as set up by `create-next-app`.
- Icons: Phosphor (`@phosphor-icons/react`). If the shadcn CLI supports it, `components.json` sets `iconLibrary` to Phosphor so generated components use it too. Server Components import from `@phosphor-icons/react/ssr`.
- Vitest with jsdom and React Testing Library for unit and component tests.

### Routes

The route group keeps the shell out of future pages that must not have it (such as login).

```
src/app/
  layout.tsx              # <html lang="es">, font, NextIntlClientProvider
  globals.css             # Theme tokens (see Theme)
  (app)/
    layout.tsx            # TopBar + <main> with bottom padding + FloatingNav
    page.tsx              # /            empty
    vehiculos/page.tsx    # /vehiculos   PageHeader "Vehículos"
    clientes/page.tsx     # /clientes    PageHeader "Clientes"
    turnos/page.tsx       # /turnos      PageHeader "Turnos"
    trabajos/page.tsx     # /trabajos    PageHeader "Trabajos"
```

URLs are Spanish because users see them; route folder names are the only Spanish identifiers in code, and they are defined once in the nav config.

### Layout

- **Top bar:** full width, slim (`h-12`), `bg-background` with a bottom `border-border`. Left: "Torque", and "× <shop name>" in `text-muted-foreground` when a name is passed. Not sticky: it scrolls away so content gets the full screen.
- **Main:** centered container (`max-w-5xl`, side padding `px-4`, `sm:px-6`). Bottom padding reserves the floating bar's space: `padding-bottom: calc(var(--floating-nav-space) + env(safe-area-inset-bottom))`.
- **Floating bar:** `position: fixed`, centered horizontally, `bottom: calc(var(--floating-nav-offset) + env(safe-area-inset-bottom))`. Pill-shaped (`rounded-full`), `bg-card`, `border-border`, soft shadow, 56px tall, full width minus the side gutter, up to `max-w-sm`. Five equal-width links share that width, each with the icon stacked above its label (11px, `font-medium`); at 360px each is about 62px wide and 48px tall. The transparent band around the bar lets clicks through (`pointer-events-none`). Active item: `bg-primary text-primary-foreground` on a pill. Inactive: `text-muted-foreground`, `hover:bg-muted hover:text-foreground`. Visible focus ring (`ring-ring`). Icons are `aria-hidden`; the visible label is the link's accessible name.
- Layout sizes live as CSS variables next to the theme (`--floating-nav-height`, `--floating-nav-offset`, `--floating-nav-space` = height + offset + a small gap) so the bar and the reserved padding cannot drift apart.
- Viewport metadata sets `viewportFit: "cover"` so `env(safe-area-inset-bottom)` works on iOS.

### Icons (Phosphor)

| Item | Icon | Route |
|---|---|---|
| Inicio | `HouseIcon` | `/` |
| Vehículos | `CarIcon` | `/vehiculos` |
| Clientes | `UsersIcon` | `/clientes` |
| Turnos | `CalendarDotsIcon` | `/turnos` |
| Trabajos | `WrenchIcon` | `/trabajos` |

Icons are 22px. Inactive items use the `regular` weight and the active item uses `fill`, so the current section shows through shape as well as color.

### Theme

All colors are defined in `:root` in `globals.css` with shadcn token names, as required by [conventions.md](../../docs/conventions.md#colors-and-theming). The shadcn `.dark` block is removed. Values:

| Token | Value |
|---|---|
| `--background` | `#F4F1EA` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#22302F` |
| `--card`, `--popover` | `#FAF8F3` |
| `--primary`, `--ring` | `#2F7A78` |
| `--primary-foreground` | `#FAF8F3` |
| `--secondary`, `--muted`, `--accent` | `#E8E3D8` |
| `--muted-foreground` | `#6B6558` |
| `--border`, `--input` | `#DAD3C5` |
| `--destructive` | `#B4442F` |
| `--chart-*`, `--sidebar-*` | Derived from the same palette during task 2 and recorded in conventions.md |

Values may be written as `oklch()` to match shadcn's generated file, as long as they equal the table.

## Components and code

| Item | Location | New / reused / extended |
|---|---|---|
| `Button` | `src/components/ui/` | Reused (shadcn CLI, unedited) |
| `TopBar` | `src/components/shared/top-bar.tsx` | New, generic. Props: `appName`, `shopName?`. Server Component |
| `FloatingNav` | `src/components/shared/floating-nav.tsx` | New, generic. Props: `items: { href, label, icon }[]` (`icon` is a Phosphor `Icon` component), `ariaLabel`. Knows nothing about vehicles, clients, etc. Client Component (needs `usePathname`) |
| `MainNav` | `src/app/(app)/_components/main-nav.tsx` | New, app-specific. Client Component that maps `NAV_ITEMS` and `nav.*` translations into `FloatingNav` props. Needed because icon components are functions and can't be passed from a Server Component (the layout) to a Client Component |
| `PageHeader` | `src/components/shared/page-header.tsx` | New, generic. Props: `title`, `description?`, `actions?` (for future buttons). Server Component |
| `NAV_ITEMS` | `src/lib/navigation.ts` | New. Single source of the app's sections: `{ href, labelKey, icon }[]` |
| `isNavItemActive(pathname, href)` | `src/lib/navigation.ts` | New. Pure function: `/` matches only `/`; other hrefs match themselves and their sub-paths (`/vehiculos/123`) but not lookalikes (`/vehiculosx`) |
| `cn` | `src/lib/utils.ts` | Reused (generated by shadcn) |

`MainNav` is the only place that combines `NAV_ITEMS` and translations with `FloatingNav`, so the shared components stay free of app-specific data and text. `(app)/layout.tsx` renders `TopBar`, `<main>` and `MainNav`.

## Validation

None. There are no forms.

## UI text

New `messages/es.json` keys:

```json
{
  "app": { "name": "Torque" },
  "nav": {
    "ariaLabel": "Navegación principal",
    "home": "Inicio",
    "vehicles": "Vehículos",
    "clients": "Clientes",
    "appointments": "Turnos",
    "jobs": "Trabajos"
  }
}
```

Section page titles reuse the `nav.*` keys. The "×" separator in the top bar is part of the `TopBar` markup, not a translatable string.

## Tests

- RLS (pgTAP): none (no database changes).
- Unit (Vitest):
  - `isNavItemActive`: `/` vs `/`, `/` vs `/vehiculos`, section root, section sub-path, lookalike prefix, trailing slash.
  - `NAV_ITEMS`: five items in the required order, unique hrefs, every `labelKey` exists in `messages/es.json`.
  - `FloatingNav` (Testing Library): renders a `nav` with the given `aria-label`; each link shows its label, has it as its accessible name, and has the right `href`; exactly one link has `aria-current="page"` for a given pathname (mocking `usePathname`).
  - `TopBar`: shows "Torque" alone without `shopName`, and "Torque × Taller Ejemplo" with it.
- Manual check (no E2E by constitution): scroll to the bottom at 360px and at desktop width to confirm the bar never covers content; check that all five labels fit at 360px without truncation, and check keyboard focus.
- Theme token rule: a Vitest test scans `src/components/**` and `src/app/**` (excluding `globals.css`) for hex colors, `rgb(`/`hsl(`, arbitrary color classes (`bg-[#`) and Tailwind palette color classes (`-teal-`, `-gray-`, …) and fails if any are found.

## Risks and alternatives

- **Labels on narrow screens.** Five labelled items need about 300px; the longest label is "Vehículos". At 360px this fits with the planned sizes. If a future section is added or a label grows, the bar needs a new layout decision (e.g. a "Más" item) instead of shrinking text.
- **The fixed bar could cover content** if a page adds its own fixed or full-height elements. Mitigated by reserving the space in the shared layout through one set of CSS variables; pages must not set their own bottom padding for the bar.
- **Scaffolding into a non-empty root.** `create-next-app` may refuse or overwrite files. It is run in a temporary folder and its files are moved in, merging `package.json` and `.gitignore` by hand.
- **Two icon sets.** shadcn components ship with Lucide icons (e.g. chevrons, close buttons). If the CLI's `iconLibrary` option doesn't support Phosphor, those few internal icons stay Lucide and all app code uses Phosphor only. This is checked in task 2 and recorded in conventions.md.
- **Alternative: sidebar navigation.** Rejected by the owner in favor of a bottom bar, which also works better on phones.
- **Alternative: English URLs.** Rejected: users see the URLs and the UI is Spanish.
