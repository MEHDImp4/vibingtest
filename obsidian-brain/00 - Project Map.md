# Project Map

VoxFlow is a Windows-first Electron desktop app for system-wide hold-to-talk voice input. It records audio through a Python native helper, transcribes it through a selected ASR provider, optionally rewrites or translates the transcript through an LLM, and pastes the final text back into the active app.

## Core Notes

- [[01 - Product Intent]]
- [[02 - System Architecture]]
- [[03 - Runtime Capture Flow]]
- [[04 - Main Process]]
- [[05 - Native Helper]]
- [[06 - Renderer UI]]
- [[07 - Preload and IPC Contract]]
- [[08 - AI Pipeline]]
- [[09 - Settings and History Storage]]
- [[10 - Development Workflow]]
- [[11 - Known Risks and Gaps]]
- [[12 - Source Index]]

## High-Signal Source Files

- `ARCHITECTURE.md`
- `package.json`
- `src/shared/types.ts`
- `src/main/index.ts`
- `src/main/native-bridge.ts`
- `src/main/ai-pipeline.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/native/helper.py`
- `src/renderer/src/App.tsx`
- `src/renderer/src/pages/Dashboard.tsx`

## Mental Model

The project has four important boundaries:

1. [[04 - Main Process]] owns orchestration, app lifecycle, windows, tray, state, provider calls, and persistence.
2. [[05 - Native Helper]] owns global hotkeys, microphone capture, active-window detection, and simulated paste.
3. [[07 - Preload and IPC Contract]] is the safe boundary between Electron and React.
4. [[06 - Renderer UI]] displays capture state, settings, history, and overlay feedback.

## Update Policy

When changing the app, update the matching note in this vault. When adding an IPC channel, provider, setting, or persistent data shape, update [[07 - Preload and IPC Contract]], [[08 - AI Pipeline]], or [[09 - Settings and History Storage]].

