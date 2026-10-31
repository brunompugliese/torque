# 014 — UI adjustments: Requirements

**Status:** Done

## Problem

Six small inconsistencies found while using the app: confirmations opened over a modal did not blur the page behind them, the job's status history repeated the status pill, Clientes kept the search text in the URL (the follow-up pending since [spec 006](../006-vehicles/tasks.md)), and the shop's logo and name in the header did nothing when clicked.

## Users

All roles.

## Acceptance criteria

- [x] Given any modal or confirmation, including a confirmation opened from inside another modal (archive, rename, cancel, close a job, send quote), when it opens, then what is behind it is dimmed and blurred.
- [x] Given a job's "Historial de estados", when it shows, then each entry has a dot in the status' color and the status as plain bold text, followed by the user and date.
- [x] Given the Clientes page, when the user searches, then the URL never holds the search text (it travels in the Server Action body) and `buscar` in the URL is ignored by the server, as in Vehículos.
- [x] Given the header, when the user clicks the shop's logo, name or the blank space within that block, then the app goes to `/inicio`.
- [x] Given the job modal's view, when it shows, then the job's number is not in the header: it is in the body as "Número de orden" ("N° 000123"), above Kilometraje, with Cliente on the left spanning both rows.
- [x] Given any search box (the lists and the searchable dropdowns), when the user types, then the search runs 300 ms after the last keystroke (was 200 ms).

## Out of scope

Rate limiting and other defensive patterns (a separate spec).
