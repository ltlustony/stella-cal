# ADR-004: Tech Stack — React + TypeScript + Vite

**Status:** Accepted  
**Date:** 2026-08-27

## Decision

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18+** | Component model fits calendar + list views; large ecosystem |
| Language | **TypeScript** | Type safety for domain model (Doctor, Region, Visit, Purchase) |
| Build | **Vite** | Fast dev, small bundles, PWA plugin |
| Styling | **Tailwind CSS** | Rapid UI, responsive, consistent |
| Calendar | **FullCalendar** | Industry standard, supports month/week/day views, customizable |
| Excel Parsing | **SheetJS (xlsx)** | Parse .xlsx/.xls in browser, no server needed |
| DB | **Dexie.js** | IndexedDB wrapper, Promise-based, TypeScript support |
| Charts | **Recharts** or **Chart.js** | Purchase trend visualization |
| State | **React Context + useReducer** | Simple enough for single-user app; no Redux needed |

## Not Included

- No router needed (single-page app with tabs/views)
- No auth (single user)
- No backend (all client-side)