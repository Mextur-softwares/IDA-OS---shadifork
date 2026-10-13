# IDA OS desktop app

The browser inside the normal website is constrained by browser iframe security rules. The desktop build uses Electron's Chromium webview for browsing pages inside the IDA OS window.

## Run locally

- Install Node.js (current LTS).
- Run `npm install`.
- Run `npm run electron:dev`.

## Build a Windows installer

Run `npm run electron:build` on Windows (or use the matching build target on another supported OS). The installer output is written to `release/`.

This is a Chromium-based desktop shell, not Google's proprietary Chrome browser. Website owners can still restrict embedding or access, and users should only visit trusted websites.
