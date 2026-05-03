import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Whisper transcription for VoxFlow")
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default=None)
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    parser.add_argument("--compute-type", default="auto", choices=["auto", "int8", "float16", "int8_float16"])
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "error": (
                "faster-whisper is not installed for this Python. "
                "Run: pip install faster-whisper"
            ),
            "detail": str(exc),
        }))
        return 2

    def is_cuda_load_failure(exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "cublas" in message
            or "cudnn" in message
            or "cuda" in message
            or "cannot be loaded" in message
        )

    device = args.device
    compute_type = args.compute_type
    
    if device == "auto":
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"
            
    if compute_type == "auto":
        compute_type = "float16" if device == "cuda" else "int8"

    def run_transcription(device: str, compute_type: str) -> tuple[str, str]:
        # Support for the new 'turbo' model which requires a specific HF repo for faster-whisper
        model_name = args.model
        if model_name.lower() == "turbo":
            model_name = "deepdml/faster-whisper-large-v3-turbo-ct2"
            
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, _info = model.transcribe(
            args.audio_path,
            language=args.language,
            beam_size=5,
            vad_filter=True,
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()
        return transcript, device

    try:
        try:
            transcript, used_device = run_transcription(args.device, args.compute_type)
        except Exception as exc:
            if not is_cuda_load_failure(exc):
                raise
            transcript, used_device = run_transcription("cpu", "int8")

        print(json.dumps({"ok": True, "text": transcript, "device": used_device}, ensure_ascii=True))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
