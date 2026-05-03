import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'
import readline from 'readline'
import { NativeEvent, NativeCommand, AppSettings } from '@shared/types'

type EventHandler = (event: NativeEvent) => void

export class NativeBridge {
  private proc: ChildProcess | null = null
  private handlers: EventHandler[] = []
  private ready = false

  start(settings: AppSettings): void {
    if (this.proc) return

    const nativePath = app.isPackaged
      ? path.join(process.resourcesPath, 'native', 'helper.py')
      : path.join(app.getAppPath(), 'src', 'native', 'helper.py')

    // Try python3 then python
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3'

    this.proc = spawn(pythonBin, [nativePath], {
      env: {
        ...process.env,
        DICTATE_HOTKEY: settings.dictateHotkey,
        TRANSLATE_HOTKEY: settings.translateHotkey,
        UNDO_HOTKEY: settings.undoHotkey,
        MICROPHONE_DEVICE: settings.microphoneDevice
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.proc.on('error', (error) => {
      this.handlers.forEach((handler) => handler({
        event: 'error',
        message: `Failed to start native helper: ${error.message}`
      }))
    })

    const rl = readline.createInterface({ input: this.proc.stdout! })
    rl.on('line', (line) => {
      try {
        const event: NativeEvent = JSON.parse(line)
        if (event.event === 'ready') this.ready = true
        this.handlers.forEach((h) => h(event))
      } catch {
        // non-JSON output from Python (print statements during dev)
        console.debug('[native]', line)
      }
    })

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[native:stderr]', chunk.toString())
    })

    this.proc.on('exit', (code) => {
      this.ready = false
      this.proc = null
      console.log(`[native] helper exited with code ${code}`)
    })
  }

  send(cmd: NativeCommand): void {
    if (!this.proc?.stdin?.writable) return
    this.proc.stdin.write(JSON.stringify(cmd) + '\n')
  }

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler)
  }

  updateHotkeys(settings: AppSettings): void {
    this.send({
      cmd: 'update_hotkeys',
      dictate_hotkey: settings.dictateHotkey,
      translate_hotkey: settings.translateHotkey,
      undo_hotkey: settings.undoHotkey,
      microphone_device: settings.microphoneDevice
    })
  }

  listDevices(): void {
    this.send({ cmd: 'list_devices' })
  }

  undo(): void {
    this.send({ cmd: 'undo' })
  }

  paste(): void {
    this.send({ cmd: 'paste' })
  }

  stop(): void {
    if (this.proc) {
      this.send({ cmd: 'shutdown' })
      setTimeout(() => this.proc?.kill(), 1000)
    }
  }

  isReady(): boolean {
    return this.ready
  }
}
