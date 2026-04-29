# System Architecture

## Layers

```text
React renderer
  |
Preload bridge: window.voxflow
  |
Electron main process
  |-- settings/history stores
  |-- tray and windows
  |-- ASR and LLM providers
  |
NativeBridge
  |
Python helper over stdin/stdout JSON lines
  |-- global hotkeys
  |-- microphone WAV capture
  |-- active app detection
  |-- clipboard paste automation
```

## Directory Responsibilities

- `src/main`: [[04 - Main Process]]
- `src/preload`: [[07 - Preload and IPC Contract]]
- `src/renderer`: [[06 - Renderer UI]]
- `src/shared`: shared types, defaults, and IPC constants
- `src/native`: [[05 - Native Helper]]

## Important Design Choices

- Main process makes all provider calls. Renderer never calls OpenAI, Anthropic, NVIDIA, or Deepgram directly.
- Settings and history are stored in Electron `userData`.
- Native events are unidirectional JSON messages from Python to Electron.
- Native commands are JSON messages from Electron to Python.
- App state is broadcast to all windows through IPC.

## Related

- [[03 - Runtime Capture Flow]]
- [[07 - Preload and IPC Contract]]
- [[09 - Settings and History Storage]]

