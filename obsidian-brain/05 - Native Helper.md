# Native Helper

The native helper is a Python process launched by Electron. It owns OS-level functionality that is awkward or unavailable in the renderer.

## Key Files

- `src/native/helper.py`
- `src/native/transcribe_local.py`
- `src/native/requirements.txt`

## Responsibilities

- Listen for global hotkeys through `pynput`.
- Record microphone audio through `sounddevice`.
- Write 16 kHz mono WAV files to the OS temp directory.
- Detect active app/window on Windows through `pywin32` and `psutil`.
- Copy text to clipboard through `pyperclip`.
- Simulate `Ctrl+V` through `pyautogui`.
- Communicate with main process through newline-delimited JSON.

## Native Events

- `ready`
- `hotkey_down`
- `hotkey_up`
- `error`
- `log`

## Native Commands

- `update_hotkeys`
- `paste`
- `shutdown`

## Notes

The helper normalizes hotkey aliases independently from the renderer. If hotkey behavior changes, keep renderer normalization and helper normalization aligned.

## Related

- [[07 - Preload and IPC Contract]]
- [[03 - Runtime Capture Flow]]
- [[11 - Known Risks and Gaps]]

