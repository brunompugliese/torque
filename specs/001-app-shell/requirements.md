# 001 — App shell and homepage: Requirements

**Status:** Done

## Problem

There is no frontend yet. Before any feature screen can be built, the app needs a base: the Next.js project, the visual theme, and a consistent way to move between the main sections (vehicles, clients, appointments, jobs) on any screen size.

## Users

All roles (`owner`, `receptionist`, `mechanic`). Everyone uses the same navigation to reach the section they work in.

## User stories

- As any user, I want to reach vehicles, clients, appointments and jobs from any page in one tap, so that I don't have to go back through menus.
- As any user, I want to always see which section I'm in, so that I don't get lost.
- As any user, I want navigation that never hides the page content, so that I can read and use everything on the page.
- As any user on a phone at the shop, I want the navigation within thumb reach, so that I can use the app with one hand.
- As the project owner, I want every color defined as a variable in one place, so that the app can move to another brand kit without touching components.

## Acceptance criteria

Navigation

- [x] Given any page, when it loads, then a floating bar is visible at the bottom center of the screen with five items, each showing an icon with its Spanish label below it, in this order: Inicio, Vehículos, Clientes, Turnos, Trabajos.
- [x] Given the floating bar, when the user taps an item, then the app navigates to `/`, `/vehiculos`, `/clientes`, `/turnos` or `/trabajos` respectively.
- [x] Given the current URL is a section or any sub-path of it (e.g. `/vehiculos/123`), when the bar renders, then that section's item is highlighted (filled icon on the primary color) and has `aria-current="page"`, and no other item does. `Inicio` is active only on `/`.
- [x] Given a screen reader, when it reads the bar, then the bar is a `nav` landmark named "Navegación principal" and each item is announced by its visible Spanish label (icons are hidden from screen readers).
- [ ] Given keyboard-only use, when the user tabs through the bar, then every item is reachable and shows a visible focus ring.

Layout

- [x] Given any page with content taller than the screen, when the user scrolls to the end, then the last content is fully visible above the floating bar (the page reserves bottom space equal to the bar height plus its offset and the device's safe area).
- [ ] Given a phone with a home indicator (iOS safe area), when a page loads, then the bar sits above the home indicator.
- [x] Given any page, when it loads, then a slim top bar shows "Torque × <shop name>". Until auth exists (see Out of scope), it shows only "Torque".
- [x] Given a screen width of 360px, when any page loads, then nothing overflows horizontally and all five bar items, with their labels, fit on one line without truncation and are tappable (at least 44px tall and 56px wide each).

Pages

- [x] Given `/`, when it loads, then it shows the top bar and floating bar and no other content.
- [x] Given `/vehiculos`, `/clientes`, `/turnos` or `/trabajos`, when it loads, then it shows the section's title (Vehículos, Clientes, Turnos, Trabajos) and no other content.

Theme and text

- [x] Given the app, when it renders, then it uses the Sand & Teal palette in light mode only, with no pure white background.
- [x] Given any component, when its source is inspected, then it uses theme tokens only (no hex, `rgb()`, Tailwind palette colors or arbitrary color values), as defined in [docs/conventions.md](../../docs/conventions.md#colors-and-theming).
- [x] Given any visible text, when its source is inspected, then it comes from `messages/es.json` through `next-intl`.

## Out of scope

- Login, sessions and route protection (own spec, next). Pages are publicly reachable until then, and they show no data.
- Showing the real shop name: it needs an authenticated session to read `shop`. The top bar accepts the name so the auth spec only has to pass it.
- Any content on the homepage or the section pages beyond their titles.
- Dark mode.
- End-to-end browser tests (excluded by the constitution).

## Open questions

- None. Decided with the owner: bar items with icon and label, including Inicio, Spanish URLs, auth in a separate spec, slim top bar with "Torque × <shop name>".
