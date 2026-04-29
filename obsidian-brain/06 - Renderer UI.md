# Renderer UI

The renderer is a React UI exposed through Electron windows.

## Key Files

- `src/renderer/src/App.tsx`
- `src/renderer/src/pages/Dashboard.tsx`
- `src/renderer/src/hooks/useIpc.ts`
- `src/renderer/src/components/Waveform.tsx`
- `src/renderer/src/components/Spinner.tsx`
- `src/renderer/src/index.css`

## Windows

- Main/settings window: navigation for Capture, Settings, and History.
- Overlay window: small floating recording/processing/done/error surface.

## Main Views

- Capture: current native status, recording state, raw transcript preview, final text copy action.
- Settings: hotkeys, ASR provider, LLM provider, model names, API keys, output behavior.
- History: local transcript entries with copy/delete/clear actions.

## Renderer Constraints

- It calls `window.voxflow`, not Electron APIs directly.
- It receives provider results via IPC events.
- It sends settings, history, clipboard, and window-control requests through preload.
- It should not receive persisted API keys except as user-entered settings data.

## Related

- [[07 - Preload and IPC Contract]]
- [[09 - Settings and History Storage]]

