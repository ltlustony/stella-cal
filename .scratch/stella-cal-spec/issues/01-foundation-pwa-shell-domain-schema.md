# 01: Foundation — PWA shell, domain model, and IndexedDB schema & repositories

**What to build:** An installable, offline-capable app that boots to a working shell and initialises local storage. All four entities — `Region`, `Doctor`, `Product`, `Purchase`, `Visit` — are typed in the domain layer and persisted through a single data-access layer (Dexie/IndexedDB) that survives app restarts. The specialist's data is private to their device.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] App can be installed to the home screen and opens in full screen (PWA manifest + service worker per ADR-001).
- [x] App opens and runs with no internet connection (static assets served offline).
- [x] App data persists across app restarts (schemas defined, DB initialised, no re-import needed on open).
- [x] Domain types for Region, Doctor, Product, Purchase, and Visit match the glossary attributes.
- [x] Data-access layer is the single boundary between app logic and storage (repositories wrap Dexie), with schemas and indexes matching the spec: `regions`, `doctors` (indexed by `regionId`), `purchases` (indexed by `[doctorId, year, month]`), `visits` (indexed by `date`).
- [x] The UI layer is wired to React Context + useReducer (thin components, no router needed per ADR-004).