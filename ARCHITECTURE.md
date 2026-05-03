# VoxFlow Architecture

This project is a Windows-first Electron desktop app for global hold-to-talk voice input.

## Current Structure

- `src/main`: Electron main process. Owns app lifecycle, tray, windows, IPC, local settings/history stores, native-helper process management, and the ASR/LLM pipeline.
- `src/preload`: Safe bridge exposed to the renderer through `window.voxflow`.
- `src/renderer`: React UI for capture status, settings, history, and the floating overlay.
- `src/shared`: Shared TypeScript types and IPC channel constants.
- `src/native`: Native helper for global hotkeys, microphone recording, active-window detection, and paste injection. In production, these are compiled into standalone executables (`voxflow-helper.exe` and `voxflow-transcribe.exe`).

## Runtime Flow

1. The Electron main process starts and creates the tray plus hidden overlay window.
2. `NativeBridge` launches the native helper (either `helper.py` in dev or `voxflow-helper.exe` in prod) and sends configured hotkeys.
3. The helper listens for global key down/up events.
4. On hotkey down, the helper starts recording audio and emits `hotkey_down`.
5. On hotkey release, the helper writes a temp WAV file and emits `hotkey_up` with audio path, duration, mode, and active app.
6. Main process runs `audio -> ASR -> raw transcript -> LLM rewrite/translate -> final text`.
7. If auto-paste is enabled, main writes the final text to the clipboard and tells the helper to press `Ctrl+V`.
8. A local history entry is written to the Electron user data directory.

## MVP Boundaries

- Electron handles orchestration, persistence, UI, provider calls, logs, and error propagation.
- API keys are encrypted using Electron's `safeStorage` before being written to `settings.json`.
- The native helper stays intentionally small and JSON-line based. In production, it is a compiled executable to ensure zero-dependency installation.
- Provider-specific logic is isolated in `src/main/ai-pipeline.ts`, including support for long audio polling with NVIDIA NIM.
- LLM rewriting can be disabled by selecting `None`, which pastes the raw ASR transcript.
 Translation mode also falls back to raw transcript when LLM is disabled.
- NVIDIA NIM rewrite uses the OpenAI-compatible chat completion API at `https://integrate.api.nvidia.com/v1/chat/completions`.
- Recommended NVIDIA rewrite model: `nvidia/llama-3.3-nemotron-super-49b-v1.5`, which replaces the older `v1` default.
- Renderer code never receives API keys except through the settings form and never calls providers directly.

## Native Helper Requirements

Install Python dependencies before running the full desktop flow:

```powershell
pip install -r src\native\requirements.txt
```

The helper currently uses `pynput`, `sounddevice`, `pyperclip`, `pyautogui`, and Windows-specific active-window detection through `pywin32` plus `psutil`.
