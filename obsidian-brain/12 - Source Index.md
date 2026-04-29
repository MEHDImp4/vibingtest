# Source Index

## Root

- `ARCHITECTURE.md`: human architecture summary.
- `package.json`: app metadata, scripts, dependencies.
- `electron.vite.config.ts`: Electron/Vite build config.
- `electron-builder.config.js`: packaging config.
- `tailwind.config.js`: Tailwind theme config.
- `tsconfig*.json`: TypeScript config.

## Main Process

- `src/main/index.ts`: lifecycle and capture pipeline.
- `src/main/ai-pipeline.ts`: ASR and LLM provider logic.
- `src/main/native-bridge.ts`: Python child process bridge.
- `src/main/ipc.ts`: IPC handlers.
- `src/main/settings-store.ts`: settings JSON store.
- `src/main/history-store.ts`: transcript history JSON store.
- `src/main/windows.ts`: Electron window helpers.
- `src/main/tray.ts`: tray integration.

## Preload and Shared

- `src/preload/index.ts`: safe renderer API.
- `src/shared/types.ts`: app settings, defaults, transcription entries, IPC constants, native protocol types.

## Renderer

- `src/renderer/src/App.tsx`: main app shell, settings, history, overlay.
- `src/renderer/src/pages/Dashboard.tsx`: capture dashboard.
- `src/renderer/src/hooks/useIpc.ts`: IPC listener hook.
- `src/renderer/src/components/*.tsx`: UI components.
- `src/renderer/src/index.css`: styling.

## Native

- `src/native/helper.py`: hotkeys, recording, active app detection, paste automation.
- `src/native/transcribe_local.py`: local Whisper runner.
- `src/native/requirements.txt`: Python dependencies.

## Related

- [[00 - Project Map]]
- [[02 - System Architecture]]

