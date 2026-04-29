# AI Pipeline

The AI pipeline lives in `src/main/ai-pipeline.ts` and is called only from the main process.

## ASR Providers

- `local-whisper`: runs `src/native/transcribe_local.py` through `python` or `python3`.
- `openai-whisper`: calls OpenAI audio transcription with `whisper-1`.
- `deepgram`: posts WAV bytes to Deepgram listen API.
- `nvidia-nim`: posts base64 WAV content to NVIDIA NIM multimodal endpoint.

## LLM Providers

- `none`: returns the raw transcript.
- `openai`: uses OpenAI chat completions.
- `anthropic`: uses Anthropic messages.
- `nvidia-nim`: uses OpenAI-compatible chat completions with NVIDIA base URL.

## Modes

- `dictate`: edits rough transcript according to rewrite style.
- `translate`: infers the intended sentence and translates into target language.

## Defaults

- ASR: `local-whisper`
- LLM: `none`
- Local ASR model: `base`
- NVIDIA rewrite model: `nvidia/llama-3.3-nemotron-super-49b-v1.5`

## Important Behavior

If OpenAI Whisper is selected but no OpenAI key exists and an NVIDIA key exists, ASR falls back to NVIDIA NIM.

## Related

- [[03 - Runtime Capture Flow]]
- [[09 - Settings and History Storage]]
- [[11 - Known Risks and Gaps]]

