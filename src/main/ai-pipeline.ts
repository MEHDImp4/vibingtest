import fs from 'fs'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { AppSettings, AsrProvider, LlmProvider, RecordingMode, StepError, StepResult } from '@shared/types'
import { app } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import os from 'os'

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioPath: string,
  settings: AppSettings
): Promise<string> {
  const result = await transcribeAudioStep(audioPath, settings)
  if (!result.ok) throw new Error(result.error?.message ?? 'Transcription failed')
  return result.value ?? ''
}

export async function transcribeAudioStep(
  audioPath: string,
  settings: AppSettings
): Promise<StepResult<string>> {
  const effectiveAsrProvider = settings.asrProvider === 'openai-whisper' && !settings.openaiApiKey && settings.nvidiaApiKey
    ? 'nvidia-nim'
    : settings.asrProvider

  const primary = await runStep('asr', effectiveAsrProvider, () => transcribeWithProvider(audioPath, settings, effectiveAsrProvider), asrTimeoutMs(effectiveAsrProvider))
  if (primary.ok) return primary

  const canFallback = settings.offlineFallback && effectiveAsrProvider !== 'local-whisper' && await isLocalWhisperAvailable()
  if (!canFallback) return primary

  console.warn(`[pipeline:asr] ${effectiveAsrProvider} failed, falling back to local-whisper: ${primary.error?.message}`)
  const fallback = await runStep('asr', 'local-whisper', () => transcribeWithProvider(audioPath, settings, 'local-whisper'), asrTimeoutMs('local-whisper'))
  return {
    ...fallback,
    fallbackUsed: fallback.ok ? 'local-whisper' : undefined,
    error: fallback.ok ? undefined : fallback.error ?? primary.error
  }
}

async function transcribeWithProvider(
  audioPath: string,
  settings: AppSettings,
  effectiveAsrProvider: AsrProvider
): Promise<string> {
  if (effectiveAsrProvider === 'openai-whisper') {
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI Whisper is selected for speech-to-text, but the OpenAI API key is not configured. Choose NVIDIA NIM Speech as ASR provider, or add an OpenAI key.')
    }
    const client = new OpenAI({ apiKey: settings.openaiApiKey })
    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'text',
      prompt: settings.personalDictionary || undefined
    })
    return (response as unknown as string).trim()
  }

  if (effectiveAsrProvider === 'local-whisper') {
    return transcribeWithLocalWhisper(audioPath, settings)
  }

  if (effectiveAsrProvider === 'local-parakeet') {
    return transcribeWithLocalParakeet(audioPath)
  }

  // Deepgram fallback (basic REST)
  if (effectiveAsrProvider === 'deepgram') {
    if (!settings.deepgramApiKey) throw new Error('Deepgram API key is not configured')
    const audioData = fs.readFileSync(audioPath)
    const res = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${settings.deepgramApiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioData
      }
    )
    const json = (await res.json()) as {
      results: { channels: { alternatives: { transcript: string }[] }[] }
    }
    return json.results.channels[0].alternatives[0].transcript.trim()
  }

  if (effectiveAsrProvider === 'nvidia-nim') {
    return transcribeWithNvidiaNim(audioPath, settings)
  }

  throw new Error(`Unknown ASR provider: ${settings.asrProvider}`)
}

async function transcribeWithLocalWhisper(audioPath: string, settings: AppSettings): Promise<string> {
  const nativePath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'voxflow-transcribe.exe')
    : path.join(app.getAppPath(), 'src', 'native', 'transcribe_local.py')

  const model = settings.localAsrModel?.trim() || 'turbo'
  const output = await execNative(nativePath, [audioPath, '--model', model, '--device', 'auto', '--compute-type', 'auto'], 10 * 60 * 1000)
  const result = JSON.parse(output) as { ok: boolean; text?: string; error?: string; detail?: string }

  if (!result.ok) {
    const detail = result.detail ? ` (${result.detail})` : ''
    throw new Error(`${result.error ?? 'Local Whisper transcription failed'}${detail}`)
  }

  return result.text?.trim() ?? ''
}

async function transcribeWithLocalParakeet(audioPath: string): Promise<string> {
  const nativePath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'voxflow-parakeet.exe')
    : path.join(app.getAppPath(), 'src', 'native', 'transcribe_parakeet.py')

  const output = await execNative(nativePath, [audioPath, '--device', 'auto'], 30_000)
  const result = JSON.parse(output) as { ok: boolean; text?: string; error?: string; detail?: string }

  if (!result.ok) {
    const detail = result.detail ? ` (${result.detail})` : ''
    throw new Error(`${result.error ?? 'Local Parakeet transcription failed'}${detail}`)
  }

  return result.text?.trim() ?? ''
}

function execNative(nativePath: string, args: string[], timeoutMs: number): Promise<string> {
  const isExe = nativePath.endsWith('.exe')
  const cmd = isExe ? nativePath : (process.platform === 'win32' ? 'python' : 'python3')
  const finalArgs = isExe ? args : [nativePath, ...args]

  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      finalArgs,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr.trim() || stdout.trim() || error.message
          reject(new Error(`Native process failed: ${message}`))
          return
        }

        resolve(stdout.trim())
      }
    )
  })
}

async function transcribeWithNvidiaNim(audioPath: string, settings: AppSettings): Promise<string> {
  if (!settings.nvidiaApiKey) throw new Error('NVIDIA API key is not configured')

  const audioData = fs.readFileSync(audioPath)
  const audioBase64 = audioData.toString('base64')
  const endpoint = 'https://integrate.api.nvidia.com/v1/microsoft/phi-4-multimodal-instruct'
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.nvidiaApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      model: 'microsoft/phi-4-multimodal-instruct',
      messages: [
        {
          role: 'user',
          content: `<audio src="data:audio/wav;base64,${audioBase64}" /> Transcribe the audio clip into text. Return only the transcript, no explanation.`
        }
      ],
      max_tokens: 1024,
      temperature: 0
    })
  })

  let json = await res.json().catch(() => null) as NvidiaMultimodalResponse | null

  // Handle asynchronous processing (202 Accepted) for long audio
  if (res.status === 202) {
    const requestId = (json as any)?.requestId || res.headers.get('request-id') || res.headers.get('x-request-id')
    if (!requestId) {
      throw new Error('NVIDIA NIM returned 202 but no requestId was found to poll.')
    }

    console.log(`[pipeline:asr] NVIDIA NIM pending (202), polling for request: ${requestId}`)
    
    let attempts = 0
    const maxAttempts = 45 // Up to ~90 seconds
    const pollInterval = 2000

    while (attempts < maxAttempts) {
      attempts++
      await new Promise(r => setTimeout(r, pollInterval))
      
      const pollRes = await fetch(`https://api.nvidia.com/v1/status/${requestId}`, {
        headers: {
          Authorization: `Bearer ${settings.nvidiaApiKey}`,
          Accept: 'application/json'
        }
      })

      const pollJson = await pollRes.json().catch(() => null) as NvidiaMultimodalResponse | null
      
      if (pollRes.status === 200) {
        const transcript = pollJson?.choices?.[0]?.message?.content?.trim()
        if (transcript) return transcript
        throw new Error('NVIDIA NIM polling returned 200 but no transcript was found in the response')
      } 
      
      if (pollRes.status !== 202) {
        const detail = pollJson?.detail ?? pollJson?.message ?? `${pollRes.status} ${pollRes.statusText}`
        throw new Error(`NVIDIA NIM polling failed: ${detail}`)
      }
      
      // Still processing, continue loop
    }
    throw new Error('NVIDIA NIM transcription timed out after polling for 90 seconds')
  }

  if (!res.ok) {
    const detail = json?.detail ?? json?.message ?? `${res.status} ${res.statusText}`
    throw new Error(`NVIDIA NIM speech-to-text failed: ${detail}`)
  }

  const transcript = json?.choices?.[0]?.message?.content?.trim()
  if (!transcript) throw new Error('NVIDIA NIM speech-to-text returned an empty transcript')
  return transcript
}

interface NvidiaMultimodalResponse {
  choices?: Array<{ message?: { content?: string } }>
  detail?: string
  message?: string
}

// ─── Rewrite ──────────────────────────────────────────────────────────────────

function buildPrompt(
  raw: string,
  style: AppSettings['rewriteStyle'],
  mode: RecordingMode,
  targetLanguage: string,
  dictionary: string
): string {
  const styleGuide: Record<AppSettings['rewriteStyle'], string> = {
    clean: 'Produce polished everyday writing. Fix transcription mistakes, grammar, punctuation, and obvious word boundary issues while preserving the speaker\'s intent and tone.',
    formal: 'Produce a clear professional version. Improve structure, grammar, and precision, but do not add claims or details that were not spoken.',
    casual: 'Produce a natural conversational version. Keep contractions and the speaker\'s voice. Remove only distracting filler and false starts.',
    minimal: 'Apply the lightest useful edit. Fix punctuation, casing, filler words, and obvious ASR mistakes. Keep wording as close to the transcript as possible.'
  }

  if (mode === 'translate') {
    return [
      'You are a precise speech translator.',
      `Translate the spoken text into ${targetLanguage}.`,
      'First infer the intended sentence from the rough ASR transcript, including self-corrections and false starts.',
      'Then return a natural translation only. Do not explain, quote, summarize, or add new information.',
      '',
      'Rough ASR transcript:',
      raw
    ].join('\n')
  }

  return [
    'You are an expert dictation editor for a system-wide voice input app.',
    styleGuide[style],
    '',
    'Editing rules:',
    '- Preserve the original language unless translation mode is active.',
    '- Preserve meaning, speaker intent, and useful tone.',
    '- Remove filler words, repeated starts, stutters, and verbal planning phrases when they are not meaningful.',
    '- Resolve explicit self-corrections, for example "send it Tuesday no Wednesday" becomes "send it Wednesday".',
    '- When the input is informal critique or stream-of-consciousness, turn it into a clean, direct message that can be pasted as-is.',
    '- Remove meta phrases about dictation, for example "I am speaking", "I want to paste this text", "comme là je suis en train de parler", unless they are the intended content.',
    '- Fix likely ASR mistakes only when the correction is strongly implied by context.',
    '- Add punctuation, capitalization, paragraph breaks, and list formatting when the speech clearly implies them.',
    '- Keep dictated commands such as "new line", "nouvelle ligne", "comma", "virgule", "period", "point", "bullet point", "puce", and "colon" as formatting, not words, when appropriate.',
    '- For French text, preserve natural French punctuation spacing and accents when clear.',
    '- Do not invent facts, names, links, dates, tasks, or details.',
    '- If the transcript is already good, make only small edits.',
    '',
    'Return only the final text to paste. No preface, quotes, markdown fence, or explanation.',
    '',
    dictionary ? `Custom vocabulary / specific spellings to respect:\n${dictionary}\n` : '',
    'Rough ASR transcript:',
    raw
  ].join('\n')
}

export async function rewriteTranscript(
  raw: string,
  settings: AppSettings,
  mode: RecordingMode
): Promise<string> {
  const result = await rewriteTranscriptStep(raw, settings, mode)
  if (!result.ok) throw new Error(result.error?.message ?? 'Rewrite failed')
  return result.value ?? raw.trim()
}

export async function rewriteTranscriptStep(
  raw: string,
  settings: AppSettings,
  mode: RecordingMode
): Promise<StepResult<string>> {
  if (settings.llmProvider === 'none') {
    return {
      ok: true,
      step: 'llm',
      durationMs: 0,
      provider: 'none',
      value: raw.trim()
    }
  }

  const prompt = buildPrompt(raw, settings.rewriteStyle, mode, settings.targetLanguage, settings.personalDictionary)

  const primary = await runStep('llm', settings.llmProvider, () => rewriteWithProvider(prompt, raw, settings, settings.llmProvider), llmTimeoutMs(settings.llmProvider))
  if (primary.ok) return primary

  // Determine potential fallback provider
  let fallbackProvider: LlmProvider | null = null
  if (settings.llmProvider === 'local-llm') {
    // If local failed, try a cloud provider if configured
    if (settings.nvidiaApiKey) fallbackProvider = 'nvidia-nim'
    else if (settings.openaiApiKey) fallbackProvider = 'openai'
    else if (settings.anthropicApiKey) fallbackProvider = 'anthropic'
  } else if (settings.offlineFallback && await isOllamaAvailable(settings)) {
    // If cloud failed, try local
    fallbackProvider = 'local-llm'
  }

  if (!fallbackProvider) {
    console.warn(`[pipeline:llm] ${settings.llmProvider} failed; no fallback available. Using raw transcript: ${primary.error?.message}`)
    return {
      ok: true,
      step: 'llm',
      durationMs: primary.durationMs,
      provider: settings.llmProvider,
      fallbackUsed: 'raw-transcript',
      value: raw.trim(),
      error: primary.error
    }
  }

  console.warn(`[pipeline:llm] ${settings.llmProvider} failed, falling back to ${fallbackProvider}: ${primary.error?.message}`)
  const fallback = await runStep('llm', fallbackProvider, () => rewriteWithProvider(prompt, raw, settings, fallbackProvider!), llmTimeoutMs(fallbackProvider))
  if (fallback.ok) return { ...fallback, fallbackUsed: fallbackProvider }

  console.warn(`[pipeline:llm] local fallback failed; using raw transcript: ${fallback.error?.message}`)
  return {
    ok: true,
    step: 'llm',
    durationMs: primary.durationMs + fallback.durationMs,
    provider: settings.llmProvider,
    fallbackUsed: 'raw-transcript',
    value: raw.trim(),
    error: fallback.error ?? primary.error
  }
}

async function rewriteWithProvider(
  prompt: string,
  raw: string,
  settings: AppSettings,
  provider: LlmProvider
): Promise<string> {
    if (provider === 'openai') {
      if (!settings.openaiApiKey) throw new Error('OpenAI API key is not configured')
      const client = new OpenAI({ apiKey: settings.openaiApiKey })
      const res = await client.chat.completions.create({
        model: settings.llmModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3
      })
      return res.choices[0].message.content?.trim() ?? raw
    }

    if (provider === 'anthropic') {
      if (!settings.anthropicApiKey) throw new Error('Anthropic API key is not configured')
      const client = new Anthropic({ apiKey: settings.anthropicApiKey })
      const res = await client.messages.create({
        model: settings.llmModel || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
      const block = res.content[0]
      return block.type === 'text' ? block.text.trim() : raw
    }

    if (provider === 'nvidia-nim') {
      if (!settings.nvidiaApiKey) throw new Error('NVIDIA API key is not configured')
      const client = new OpenAI({
        apiKey: settings.nvidiaApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1'
      })
      const res = await client.chat.completions.create({
        model: settings.llmModel || 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
        top_p: 0.9
      })
      return res.choices[0].message.content?.trim() ?? raw
    }

    if (provider === 'local-llm') {
      return rewriteWithLocalLlm(prompt, raw, settings)
    }

  throw new Error(`Unknown LLM provider: ${provider}`)
}

async function rewriteWithLocalLlm(prompt: string, raw: string, settings: AppSettings): Promise<string> {
  const endpoint = (settings.localLlmEndpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  const model = settings.localLlmModel?.trim() || 'llama3.2:1b'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 700
        },
        messages: [
          {
            role: 'system',
            content: 'You rewrite dictation locally. Return only the final text to paste.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const json = await response.json().catch(() => null) as OllamaChatResponse | null
    if (!response.ok) {
      const detail = json?.error ?? `${response.status} ${response.statusText}`
      throw new Error(`Local LLM failed: ${detail}. Make sure Ollama is running and the model is pulled.`)
    }

    return json?.message?.content?.trim() || raw.trim()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Local LLM timed out. Make sure Ollama is running with model ${model}.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

async function runStep<T>(
  step: string,
  provider: string,
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<StepResult<T>> {
  const started = Date.now()
  console.log(`[pipeline:${step}] starting ${provider}`)

  try {
    const value = await withTimeout(operation(), timeoutMs, `${step} provider ${provider} timed out after ${timeoutMs}ms`)
    const durationMs = Date.now() - started
    console.log(`[pipeline:${step}] ${provider} succeeded in ${durationMs}ms`)
    return { ok: true, step, provider, durationMs, value }
  } catch (error) {
    const durationMs = Date.now() - started
    const normalized = normalizeError(error)
    console.error(`[pipeline:${step}] ${provider} failed in ${durationMs}ms: ${normalized.message}`)
    return { ok: false, step, provider, durationMs, error: normalized }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function normalizeError(error: unknown): StepError {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: typeof (error as NodeJS.ErrnoException).code === 'string' ? (error as NodeJS.ErrnoException).code : undefined
    }
  }

  return { message: String(error) }
}

function asrTimeoutMs(provider: AsrProvider): number {
  return provider === 'local-whisper' ? 10 * 60 * 1000 : 90_000
}

function llmTimeoutMs(provider: LlmProvider): number {
  return provider === 'local-llm' ? 60_000 : 45_000
}

export async function isOllamaAvailable(settings: AppSettings): Promise<boolean> {
  const endpoint = (settings.localLlmEndpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}

export async function isLocalWhisperAvailable(modelName?: string): Promise<boolean> {
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'transcribe_local.py')
    : path.join(app.getAppPath(), 'src', 'native', 'transcribe_local.py')

  if (!fs.existsSync(scriptPath)) return false

  // If a model is specified, try to see if it's already downloaded in the HF cache
  if (modelName) {
    const home = os.homedir()
    const modelId = modelName === 'turbo' ? 'deepdml--faster-whisper-large-v3-turbo-ct2' : `Systran--faster-whisper-${modelName}`
    const cachePath = path.join(home, '.cache', 'huggingface', 'hub', `models--${modelId.replace(/\//g, '--')}`)
    return fs.existsSync(cachePath)
  }

  return true
}

export async function isLocalParakeetAvailable(): Promise<boolean> {
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'transcribe_parakeet.py')
    : path.join(app.getAppPath(), 'src', 'native', 'transcribe_parakeet.py')

  if (!fs.existsSync(scriptPath)) return false

  // Parakeet models are usually in a 'models' subfolder
  const modelDir = app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'models', 'parakeet-tdt-0.6b-v3')
    : path.join(app.getAppPath(), 'src', 'native', 'models', 'parakeet-tdt-0.6b-v3')

  const hasEncoder = fs.existsSync(path.join(modelDir, 'encoder.int8.onnx')) || fs.existsSync(path.join(modelDir, 'encoder.onnx'))
  const hasTokens = fs.existsSync(path.join(modelDir, 'tokens.txt'))

  return hasEncoder && hasTokens
}
