# AssociateHub PWA

Portfolio reference implementation of a 2019 project, built to show an offline-first Progressive Web App for store associates on shared handheld devices.

**Stack:** Angular 6, NgRx 6 (store and effects), RxJS 6, Angular Service Worker.

## Features
- **Task list by aisle** for replenishment, price changes, planograms and recalls. Overdue tasks come first, then priority 1 ("must finish this shift").
- **Offline-first edits:** changes apply to the UI right away and are queued in an **outbox**.
  - The outbox is saved to `localStorage` through a meta-reducer, so edits survive the app being killed.
  - It syncs on every edit while online and whenever the device comes back online.
- **Sync rules** (`src/app/core/outbox-sync.ts`):
  - Mutations are sent in order, one at a time, each with an `Idempotency-Key`.
  - A 5xx or network failure is retried with exponential backoff. If it still fails, the queue stops there so later edits can't overtake earlier ones.
  - A 409 conflict means the task was reassigned or finished elsewhere. The server copy wins and the conflict is shown.
  - Repeated taps on the same task collapse into a single queued entry.
- **Reload keeps your edits:** queued local changes are re-applied on top of each fresh server snapshot, so a refresh doesn't undo them.
- **Service worker** (`ngsw-config.json`):
  - The app shell is prefetched.
  - Tasks are fetched network-first with a 4-second timeout.
  - Planograms are served cache-first.
  - The user is prompted when a new version is ready.

## Test
The reducer, selectors and sync logic are framework-free, so they're tested directly with Vitest:
```bash
npm i --no-save rxjs vitest && npx vitest run   # 11 tests
```
`ng serve`, `ng test` (Karma) and `ng build --prod` need the full Angular 6 toolchain from `package.json`.
