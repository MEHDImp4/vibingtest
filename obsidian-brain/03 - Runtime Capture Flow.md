# Runtime Capture Flow

## Dictation Flow

1. Electron starts, creates tray and overlay windows, registers IPC handlers, and starts [[05 - Native Helper]] through [[04 - Main Process]].
2. `NativeBridge` launches `src/native/helper.py` and passes hotkeys through environment variables.
3. The helper emits `ready`.
4. User presses the dictate or translate hotkey.
5. Helper starts recording and emits `hotkey_down`.
6. Main process sets state to `recording`, updates tray state, and shows overlay if enabled.
7. User releases a key in the active hotkey.
8. Helper writes a temp WAV file and emits `hotkey_up` with path, duration, mode, and active app name.
9. Main process ignores accidental taps below 0.5 seconds.
10. Main process runs [[08 - AI Pipeline]]:
    - ASR: audio file to raw transcript.
    - Optional LLM: raw transcript to final text.
11. Main process broadcasts raw and final text to renderer windows.
12. If auto-paste is enabled, main writes final text to clipboard and asks the helper to paste.
13. Main stores a local history entry.
14. Main cleans up the temp WAV file and moves state to `done`.

## State Machine

- `idle`: ready for capture
- `recording`: helper is collecting audio
- `processing`: ASR/LLM pipeline is running
- `done`: final text is ready or pasted
- `error`: native helper or provider failed

`done` and `error` reset back to `idle` shortly after being displayed.

## Related Source

- `src/main/index.ts`
- `src/native/helper.py`
- `src/main/ai-pipeline.ts`
- `src/renderer/src/pages/Dashboard.tsx`

