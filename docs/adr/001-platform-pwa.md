# ADR-001: Platform — Progressive Web Application (PWA)

**Status:** Accepted  
**Date:** 2026-08-27

## Context

The user is a sales specialist visiting doctors in clinics. They need a mobile-friendly app that includes a calendar, visit tracking, and purchase-record viewing. The app must work on a phone.

## Decision

Build as a **Progressive Web Application (PWA)**.

Rationale:
- Works on any phone browser (iOS Safari, Android Chrome) — no app store approval needed
- Can be "installed" to the home screen for native-like feel
- Single codebase, no platform-specific builds
- Offline support is achievable via Service Worker if needed later
- Updates deploy instantly without app store review

## Consequences

- No access to native calendar APIs (but web calendar libraries are sufficient)
- File upload (Excel) works natively in browser
- No push notifications without browser support (not needed for single-user)
- Can be enhanced to full native via Capacitor/Tauri later if needed