import argparse
import json
import os
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Parakeet TDT transcription for VoxFlow")
    parser.add_argument("audio_path")
    parser.add_argument("--model-dir", default=None)
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    args = parser.parse_args()

    device = args.device
    if device == "auto":
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    # Determine model directory
    if args.model_dir:
        model_dir = Path(args.model_dir)
    else:
        # Default location relative to script
        model_dir = Path(__file__).parent / "models" / "parakeet-tdt-0.6b-v3"

    try:
        import sherpa_onnx
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "error": "sherpa-onnx is not installed for this Python. Run: pip install sherpa-onnx",
            "detail": str(exc),
        }))
        return 2

    # Validate model files
    required_files = {
        "encoder": model_dir / "encoder.int8.onnx",
        "decoder": model_dir / "decoder.int8.onnx",
        "joiner": model_dir / "joiner.int8.onnx",
        "tokens": model_dir / "tokens.txt",
    }
    
    missing = [name for name, path in required_files.items() if not path.exists()]
    if missing:
        # Try non-int8 versions if int8 missing
        alt_files = {
            "encoder": model_dir / "encoder.onnx",
            "decoder": model_dir / "decoder.onnx",
            "joiner": model_dir / "joiner.onnx",
            "tokens": model_dir / "tokens.txt",
        }
        missing_alt = [name for name, path in alt_files.items() if not path.exists()]
        if missing_alt:
            print(json.dumps({
                "ok": False,
                "error": f"Missing Parakeet TDT model files in {model_dir}: {', '.join(missing)}",
                "detail": "Please download the Parakeet TDT ONNX model from NVIDIA or Sherpa-ONNX releases.",
            }))
            return 3
        else:
            required_files = alt_files

    try:
        # Configure recognizer
        config = sherpa_onnx.OfflineRecognizerConfig(
            model_config=sherpa_onnx.OfflineModelConfig(
                model_type="nemo_transducer",
                transducer=sherpa_onnx.OfflineTransducerModelConfig(
                    encoder=str(required_files["encoder"]),
                    decoder=str(required_files["decoder"]),
                    joiner=str(required_files["joiner"]),
                ),
                tokens=str(required_files["tokens"]),
                debug=False,
                num_threads=4,
                provider=device,
            )
        )
        
        recognizer = sherpa_onnx.OfflineRecognizer.from_config(config)
        
        # Transcribe
        stream = recognizer.create_stream()
        stream.accept_wave_file(args.audio_path)
        recognizer.decode_stream(stream)
        result = recognizer.get_result(stream)
        
        print(json.dumps({
            "ok": True, 
            "text": result.text.strip(), 
            "device": device
        }, ensure_ascii=True))
        return 0

    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
