# ADR-002: Data Storage — Client-Side with IndexedDB

**Status:** Accepted  
**Date:** 2026-08-27

## Context

Single user, no collaboration, no sync needed. The data consists of doctors, regions, purchase records (from Excel), and visit logs. The Excel file is uploaded manually once a month and contains the full accumulated history.

## Decision

Use **client-side storage with IndexedDB** (via Dexie.js).

Rationale:
- Single user — no backend, no auth, no server costs
- IndexedDB handles the data volume (thousands of records across years)
- No network dependency for queries (fast filtering, sorting, calendar views)
- Dexie.js provides a clean Promise-based API over IndexedDB
- Data is private to the user's device/browser
- Excel import happens entirely client-side (SheetJS/xlsx)

## Alternatives Considered

- **Backend + DB (Supabase, Firebase):** Overkill for single user; adds cost, latency, auth complexity
- **LocalStorage:** Too small (5MB limit), no indexing, no complex queries
- **SQLite via WASM:** More complex than IndexedDB for this use case

## Consequences

- Data lives in the browser; clearing browser data loses records (mitigate with Excel re-upload)
- No multi-device sync (not needed)
- Must handle large Excel imports efficiently (stream/chunk)
- Dexie.js adds ~30KB gzipped