# Settings and History Storage

Settings and history are stored locally in Electron `userData`.

## Settings

Source:

- `src/main/settings-store.ts`
- `src/shared/types.ts`

Path:

- `settings.json` under `app.getPath('userData')`

Shape:

- hotkeys
- ASR provider and local ASR model
- LLM provider and model
- API keys
- translation target
- rewrite style
- auto-paste
- overlay visibility
- start-minimized behavior

Normalization:

- Older NVIDIA model value `nvidia/llama-3.3-nemotron-super-49b-v1` is upgraded to `nvidia/llama-3.3-nemotron-super-49b-v1.5`.

## History

Source:

- `src/main/history-store.ts`
- `src/shared/types.ts`

Path:

- `history.json` under `app.getPath('userData')`

Each entry stores:

- id
- timestamp
- raw transcript
- final text
- mode
- duration
- active app name
- optional error

History is capped at 500 entries.

## Related

- [[06 - Renderer UI]]
- [[08 - AI Pipeline]]

