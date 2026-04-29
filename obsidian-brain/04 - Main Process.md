# Main Process

The main process is the owner of orchestration and trust-sensitive work.

## Key Files

- `src/main/index.ts`: app lifecycle, state transitions, capture pipeline, bridge event handling
- `src/main/windows.ts`: overlay/settings window creation and broadcast helpers
- `src/main/tray.ts`: tray menu and recording indicator
- `src/main/native-bridge.ts`: child process management and JSON-line protocol
- `src/main/ipc.ts`: renderer request handlers
- `src/main/ai-pipeline.ts`: provider calls
- `src/main/settings-store.ts`: settings persistence
- `src/main/history-store.ts`: history persistence

## Responsibilities

- Enforce single-instance behavior.
- Create windows and tray.
- Start and stop the native helper.
- Translate native events into recording state.
- Run transcription and rewrite/translation.
- Write final text to clipboard.
- Ask helper to simulate paste.
- Persist history.
- Broadcast state and results to renderer windows.

## Capture Processing

`processRecording(audioPath, duration, appName)` is the central workflow. It loads settings, runs ASR, optionally rewrites or translates, broadcasts updates, optionally pastes, writes history, handles errors, and deletes the temp audio file.

## Related

- [[03 - Runtime Capture Flow]]
- [[05 - Native Helper]]
- [[08 - AI Pipeline]]

