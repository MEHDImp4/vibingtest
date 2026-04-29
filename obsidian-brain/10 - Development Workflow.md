# Development Workflow

## Commands

From repo root:

```powershell
npm run dev
npm run build
npm run preview
npm run package
npm run lint
```

## Native Dependencies

Install Python helper dependencies:

```powershell
pip install -r src\native\requirements.txt
```

Local Whisper also depends on the packages required by `src/native/transcribe_local.py`.

## Build Stack

- Electron
- electron-vite
- React
- TypeScript
- Tailwind CSS
- Python native helper

## Generated/Ignored Areas

- `node_modules/`: dependency install output
- `out/`: build output

## Repo Note

At scan time this directory was not a Git worktree, so there is no local commit history or branch metadata available to the brain.

## Related

- [[12 - Source Index]]

