# 014 — UI adjustments: Requirements

**Status:** Done

## Problem

Four small inconsistencies found while using the app: confirmations opened over a modal did not blur the page behind them, the job's status history repeated the status pill, Clientes kept the search text in the URL (the follow-up pending since [spec 006](../006-vehicles/tasks.md)), and the shop's logo and name in the header did nothing when clicked.

## Users

All roles.

## Acceptance criteria

- [x] Given any modal or confirmation, including a confirmation opened from inside another modal (archive, rename, cancel, close a job, send quote), when it opens, then what is behind it is dimmed and blurred.
- [x] Given a job's "Historial de estados", when it shows, then each entry has a dot in the status' color and the status as plain bold text, followed by the user and date.
- [x] Given the Clientes page, when the user searches, then the URL never holds the search text (it travels in the Server Action body) and `buscar` in the URL is ignored by the server, as in Vehículos.
- [x] Given the header, when the user clicks the shop's logo, name or the blank space within that block, then the app goes to `/inicio`.