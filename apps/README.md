# Desktop app directory

This directory contains platform source code. It is not the release archive.

| Path | Owner | Tracked content | Ignored local output |
|---|---|---|---|
| `electron/` | Windows Electron shell used by the private GitHub installer workflow | shell source, tests, `package.json`, lockfile, changelog | `node_modules/`, `.build/`, `dist/` |
| `macos/SAPDWiki/` | macOS Swift/WKWebView app built in the main Mac workspace | Swift package, wrapper source, local build/package scripts | `.build/`, `dist/` |

Current production flow, output ownership, retention rules, and the GitHub workflow map are documented in
`docs/09-delivery/packaging-directory-map.md`.

Do not treat ignored files under `.build/` or `dist/` as source-of-truth release evidence. Windows release evidence lives in the private delivery repository; macOS release evidence must be recorded with the local DMG verification result.
