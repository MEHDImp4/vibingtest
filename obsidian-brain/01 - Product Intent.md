# Product Intent

VoxFlow provides system-wide voice input on Windows. The user holds a configured hotkey, speaks, releases the hotkey, and the app pastes cleaned text into whatever app was active.

## Jobs

- Capture short dictation from anywhere on the desktop.
- Translate spoken text with a separate hotkey.
- Clean rough ASR output into paste-ready writing.
- Preserve privacy boundaries by keeping API keys local and avoiding provider access from renderer code.
- Keep the app tray-first and low-friction.

## Current MVP Boundaries

- Windows-first desktop target.
- Electron orchestrates app state, windows, tray, persistence, and AI calls.
- Python handles native OS integration.
- The Python helper speaks JSON lines so it can later be replaced by another native binary.
- Local Whisper is the default ASR provider.
- LLM rewriting is optional and can be set to `none`.

## Related

- [[02 - System Architecture]]
- [[03 - Runtime Capture Flow]]
- [[11 - Known Risks and Gaps]]

