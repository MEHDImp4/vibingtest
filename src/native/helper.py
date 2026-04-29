import json
import os
import queue
import sys
import tempfile
import threading
import time
import wave
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pyautogui
import sounddevice as sd
from pynput import keyboard

try:
    import win32gui
    import win32process
    import psutil
except Exception:
    win32gui = None
    win32process = None
    psutil = None


SAMPLE_RATE = 16000
CHANNELS = 1


@dataclass
class HotkeyConfig:
    dictate: str
    translate: str
    undo: str


class JsonOut:
    @staticmethod
    def emit(payload: dict) -> None:
        print(json.dumps(payload, ensure_ascii=True), flush=True)

    @staticmethod
    def log(message: str, level: str = "info") -> None:
        JsonOut.emit({"event": "log", "level": level, "message": message})

    @staticmethod
    def error(message: str) -> None:
        JsonOut.emit({"event": "error", "message": message})


def normalize_hotkey(value: str) -> frozenset[str]:
    parts = [part.strip().lower() for part in value.replace("-", "+").split("+") if part.strip()]
    aliases = {
        "control": "ctrl",
        "ctl": "ctrl",
        "cmdorctrl": "ctrl",
        "commandorcontrol": "ctrl",
        "controlorcommand": "ctrl",
        "cmd": "win",
        "command": "win",
        "windows": "win",
        "super": "win",
        "meta": "win",
        "option": "alt",
        "alternate": "alt",
        "return": "enter",
        "esc": "escape",
        "del": "delete",
        "plus": "+",
    }
    return frozenset(aliases.get(part, part) for part in parts)


def key_name(key) -> Optional[str]:
    if isinstance(key, keyboard.KeyCode):
        return (key.char or "").lower() if key.char else None

    mapping = {
        keyboard.Key.ctrl_l: "ctrl",
        keyboard.Key.ctrl_r: "ctrl",
        keyboard.Key.shift_l: "shift",
        keyboard.Key.shift_r: "shift",
        keyboard.Key.alt_l: "alt",
        keyboard.Key.alt_r: "alt",
        keyboard.Key.cmd_l: "win",
        keyboard.Key.cmd_r: "win",
        keyboard.Key.space: "space",
        keyboard.Key.enter: "enter",
        keyboard.Key.tab: "tab",
        keyboard.Key.esc: "escape",
        keyboard.Key.backspace: "backspace",
    }
    return mapping.get(key, getattr(key, "name", None))


def active_app_name() -> str:
    if not win32gui or not win32process:
        return "Unknown"

    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "Unknown"

        title = win32gui.GetWindowText(hwnd) or "Unknown window"
        if psutil:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process_name = psutil.Process(pid).name()
            return f"{process_name} - {title}"
        return title
    except Exception as exc:
        JsonOut.log(f"active window detection failed: {exc}", "warn")
        return "Unknown"


class Recorder:
    def __init__(self) -> None:
        self.stream: Optional[sd.InputStream] = None
        self.frames: list[np.ndarray] = []
        self.started_at = 0.0
        self.lock = threading.Lock()

    def start(self) -> None:
        with self.lock:
            if self.stream:
                return
            self.frames = []
            self.started_at = time.perf_counter()
            self.stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype="int16",
                callback=self._on_audio,
            )
            self.stream.start()

    def stop(self) -> tuple[str, float]:
        with self.lock:
            if not self.stream:
                raise RuntimeError("recorder is not running")

            self.stream.stop()
            self.stream.close()
            self.stream = None
            duration = max(0.0, time.perf_counter() - self.started_at)
            audio = np.concatenate(self.frames, axis=0) if self.frames else np.zeros((0, CHANNELS), dtype=np.int16)

        fd, path = tempfile.mkstemp(prefix="voxflow-", suffix=".wav")
        os.close(fd)
        with wave.open(path, "wb") as wav:
            wav.setnchannels(CHANNELS)
            wav.setsampwidth(2)
            wav.setframerate(SAMPLE_RATE)
            wav.writeframes(audio.tobytes())
        return path, duration

    def _on_audio(self, indata, frames, time_info, status) -> None:
        if status:
            JsonOut.log(f"audio status: {status}", "warn")
        self.frames.append(indata.copy())


class Helper:
    def __init__(self) -> None:
        self.config = HotkeyConfig(
            dictate=os.environ.get("DICTATE_HOTKEY", "ctrl+shift+space"),
            translate=os.environ.get("TRANSLATE_HOTKEY", "ctrl+shift+t"),
            undo=os.environ.get("UNDO_HOTKEY", "ctrl+shift+z"),
        )
        self.pressed: set[str] = set()
        self.active_mode: Optional[str] = None
        self.recorder = Recorder()
        self.commands: queue.Queue[dict] = queue.Queue()
        self.stop_event = threading.Event()

    def run(self) -> None:
        threading.Thread(target=self._read_commands, daemon=True).start()
        listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
        listener.start()
        JsonOut.emit({"event": "ready"})

        while not self.stop_event.is_set():
            try:
                command = self.commands.get(timeout=0.1)
                self._handle_command(command)
            except queue.Empty:
                continue
            except Exception as exc:
                JsonOut.error(str(exc))

        listener.stop()

    def _read_commands(self) -> None:
        for line in sys.stdin:
            try:
                self.commands.put(json.loads(line))
            except json.JSONDecodeError:
                JsonOut.log("ignored invalid command json", "warn")

    def _handle_command(self, command: dict) -> None:
        cmd = command.get("cmd")
        if cmd == "update_hotkeys":
            self.config = HotkeyConfig(
                dictate=command.get("dictate_hotkey") or self.config.dictate,
                translate=command.get("translate_hotkey") or self.config.translate,
                undo=command.get("undo_hotkey") or self.config.undo,
            )
            self.pressed.clear()
            JsonOut.log(f"hotkeys updated: dictate={self.config.dictate}, translate={self.config.translate}, undo={self.config.undo}")
        elif cmd == "paste":
            # Small delay to let modifiers clear and target app focus stabilize
            time.sleep(0.1)
            pyautogui.hotkey("ctrl", "v")
        elif cmd == "undo":
            time.sleep(0.05)
            pyautogui.hotkey("ctrl", "z")
        elif cmd == "shutdown":
            self.stop_event.set()

    def _on_press(self, key) -> None:
        name = key_name(key)
        if not name:
            return
        self.pressed.add(name)

        if self.active_mode:
            return

        dictate = normalize_hotkey(self.config.dictate)
        translate = normalize_hotkey(self.config.translate)
        undo = normalize_hotkey(self.config.undo)
        current = frozenset(self.pressed)

        if dictate and dictate.issubset(current):
            self._start_recording("dictate")
        elif translate and translate.issubset(current):
            self._start_recording("translate")
        elif undo and undo.issubset(current):
            # Undo is a discrete trigger, not a hold-mode
            JsonOut.emit({"event": "hotkey_undo"})
            # To prevent repeated triggers, we clear pressed or wait for release
            # but issubset check is safe as long as we only emit on the transition
            # which pynput mostly handles via repeated calls.
            # We'll rely on Electron handling debouncing if needed.

    def _on_release(self, key) -> None:
        name = key_name(key)
        if not name:
            return

        stopped = False
        if self.active_mode:
            active_set = normalize_hotkey(self.config.dictate if self.active_mode == "dictate" else self.config.translate)
            if name in active_set:
                self._stop_recording()
                stopped = True

        if stopped:
            self.pressed.clear()
        else:
            self.pressed.discard(name)

    def _start_recording(self, mode: str) -> None:
        try:
            self.active_mode = mode
            self.recorder.start()
            JsonOut.emit({"event": "hotkey_down", "mode": mode})
        except Exception as exc:
            self.active_mode = None
            JsonOut.error(f"failed to start recording: {exc}")

    def _stop_recording(self) -> None:
        mode = self.active_mode or "dictate"
        self.active_mode = None
        try:
            path, duration = self.recorder.stop()
            JsonOut.emit({
                "event": "hotkey_up",
                "mode": mode,
                "audio_path": path,
                "duration": duration,
                "app_name": active_app_name(),
            })
        except Exception as exc:
            JsonOut.error(f"failed to stop recording: {exc}")


if __name__ == "__main__":
    try:
        Helper().run()
    except Exception as error:
        JsonOut.error(str(error))
