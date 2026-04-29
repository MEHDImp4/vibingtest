# Preload and IPC Contract

The preload layer exposes a constrained API as `window.voxflow`.

## Key Files

- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/main/ipc.ts`

## Exposed Renderer API

- `getSettings()`
- `saveSettings(settings)`
- `getHistory()`
- `clearHistory()`
- `deleteEntry(id)`
- `copyText(text)`
- `getNativeStatus()`
- `closeWindow()`
- `minimizeWindow()`
- `on(channel, callback)`
- `getWindowType()`

## IPC Constants

Main to renderer:

- `recording:state`
- `transcription:raw`
- `transcription:final`
- `transcription:error`
- `native:status`

Renderer to main:

- `settings:get`
- `settings:save`
- `history:get`
- `history:clear`
- `history:delete`
- `window:settings`
- `clipboard:copy`
- `native:status:get`
- `window:close`
- `window:minimize`

## Contract Rule

Add new channels to `src/shared/types.ts` first, then wire them in `src/preload/index.ts`, then implement the main process handler or broadcaster.

## Related

- [[06 - Renderer UI]]
- [[04 - Main Process]]

