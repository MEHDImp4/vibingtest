# Known Risks and Gaps

## Reliability

- Native helper depends on Python being installed and available as `python` on Windows.
- Global hotkey behavior depends on `pynput` and can vary by OS permissions, keyboard layout, and focused application.
- Simulated paste uses clipboard plus `Ctrl+V`; apps that block paste or intercept shortcuts may behave differently.
- Recordings below 0.5 seconds are ignored in main process.

## Provider Behavior

- NVIDIA NIM long audio polling is not implemented; `202` pending responses currently produce an error.
- Provider response shapes are assumed in places and may need defensive validation.
- Deepgram response parsing assumes at least one channel and one alternative.

## Security and Privacy

- API keys are stored locally in `settings.json` under Electron `userData`.
- Main process should remain the only layer that contacts external providers.
- Renderer settings view can display/edit keys, so the machine trust boundary matters.

## Maintainability

- Hotkey normalization exists in both React and Python. Changes should be mirrored.
- Local helper protocol is small and intentionally JSON-line based. Keep it stable if replacing Python with Rust or another binary.
- There are no visible tests in the scanned repo.

## Related

- [[05 - Native Helper]]
- [[08 - AI Pipeline]]
- [[07 - Preload and IPC Contract]]

