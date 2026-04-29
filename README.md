<p align="center">
  <img src=".github/assets/logo.png" alt="VoxFlow Logo" width="120">
</p>

<h1 align="center">VoxFlow</h1>

<p align="center">
  <strong>System-wide AI voice input for Windows.</strong><br>
  Hold a key, speak, and watch your voice transform into perfect text in any application.
</p>

<p align="center">
  <a href="https://mehdimp4.github.io/vibingtest/"><strong>Project Website</strong></a> &bull;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/MEHDImp4/vibingtest/releases"><img src="https://img.shields.io/github/v/release/MEHDImp4/vibingtest?include_prereleases" alt="Release"></a>
  <a href=".github/workflows/ci-cd.yml"><img src="https://img.shields.io/github/actions/workflow/status/MEHDImp4/vibingtest/ci-cd.yml?branch=main" alt="Build Status"></a>
</p>

---

## 📖 About

**VoxFlow** is a productivity-first voice interface designed to bridge the gap between spoken thought and written text. Unlike traditional dictation tools that often require manual cleanup, VoxFlow leverages the power of modern Large Language Models (LLMs) to understand your intent, fix grammar, remove filler words, and even translate your speech in real-time—all while integrating seamlessly into your existing Windows workflow.

Whether you're writing emails, coding, or chatting, VoxFlow turns your voice into a high-fidelity input device that works in every text field on your system.

---

## ✨ Features

- **Global Hold-to-Talk**: Press and hold a hotkey to start recording in any Windows application.
- **AI-Powered Rewriting**: Automatically clean up "umms," "ahhs," and grammar issues using state-of-the-art LLMs (OpenAI, Anthropic, NVIDIA NIM).
- **Auto-Paste Integration**: VoxFlow automatically types the processed text into your active window.
- **Smart Translation**: Speak in one language and have it instantly translated and typed in another.
- **Context-Aware**: Detects the active window to provide better transcription context.
- **Privacy First**: Local Python helper handles audio recording, with secure IPC communication to the Electron main process.

## 🚀 Quick Start

### Prerequisites

- **Windows 10/11**
- **Node.js** (v18 or later)
- **Python 3.10+**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MEHDImp4/vibingtest.git
   cd vibingtest
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```powershell
   pip install -r src/native/requirements.txt
   ```

4. **Configure API Keys**:
   Open the application and go to **Settings** to add your OpenAI, Anthropic, or NVIDIA API keys.

5. **Run the app**:
   ```bash
   npm run dev
   ```

## 🔑 Getting API Keys

VoxFlow supports several AI providers. You will need an API key from at least one of them to use the cloud-based features:

- **OpenAI**: Get your key from the [OpenAI Dashboard](https://platform.openai.com/api-keys) (used for Whisper and GPT models).
- **Anthropic**: Get your key from the [Anthropic Console](https://console.anthropic.com/) (used for Claude models).
- **NVIDIA NIM**: Get your key from the [NVIDIA API Catalog](https://build.nvidia.com/) (used for high-performance Llama models).
- **Deepgram**: Get your key from the [Deepgram Console](https://console.deepgram.com/) (alternative ASR provider).

*Alternatively, you can run VoxFlow in **Local-Only Mode** using Ollama and Local Whisper without any API keys.*

## 🛠️ Architecture

VoxFlow is built with a high-performance hybrid architecture:

- **Electron & React**: Provides a modern, responsive UI and manages the application lifecycle.
- **Python Native Helper**: A lightweight background process that handles global hotkeys, audio recording (via `sounddevice`), and keyboard injection (via `pyautogui`).
- **AI Pipeline**: Orchestrates the flow from raw audio to ASR (Whisper) and LLM refinement.

For a deeper dive, see [ARCHITECTURE.md](ARCHITECTURE.md).

## ⚙️ Configuration

| Setting | Description |
| --- | --- |
| **Hotkey** | Default: `CapsLock` (Hold to record). |
| **Mode** | `Rewrite`, `Translate`, or `Raw Transcript`. |
| **Provider** | Choose between OpenAI, Anthropic, or NVIDIA NIM. |
| **Model** | Select the specific LLM model (e.g., `gpt-4o`, `claude-3-5-sonnet`). |

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for the Windows community.
</p>
