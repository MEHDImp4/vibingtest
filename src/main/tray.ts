import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'

let tray: Tray | null = null

function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../resources/icon.png')
}

export function createTray(
  onOpenSettings: () => void,
  onQuit: () => void
): Tray {
  const icon = createTrayIcon(false)

  tray = new Tray(icon)
  tray.setToolTip('VoxFlow — hold hotkey to record')

  const menu = Menu.buildFromTemplate([
    { label: 'VoxFlow', enabled: false },
    { type: 'separator' },
    { label: 'Open Settings', click: onOpenSettings },
    { type: 'separator' },
    { label: 'Quit', click: onQuit }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', onOpenSettings)

  return tray
}

export function setTrayRecording(active: boolean): void {
  if (!tray) return
  tray.setImage(createTrayIcon(active))
  tray.setToolTip(active ? 'VoxFlow — recording…' : 'VoxFlow — hold hotkey to record')
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

function createTrayIcon(active: boolean): Electron.NativeImage {
  try {
    // Load the real app logo and resize to tray size
    const img = nativeImage.createFromPath(iconPath())
    if (!img.isEmpty()) {
      const resized = img.resize({ width: 16, height: 16 })
      resized.setTemplateImage(false)

      if (!active) return resized

      // When recording: Return the base icon; the tooltip already signals state
      return resized
    }
  } catch {
    // fall through to SVG fallback
  }

  // SVG fallback (dev without resources/ folder built yet)
  const fill = active ? '#d8e2c8' : '#f5f5f0'
  const ring = active ? '#ef4444' : '#8f8d84'
  const svg = [
    '<svg xmlns="https://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<rect width="32" height="32" rx="8" fill="#10100e"/>',
    `<circle cx="16" cy="16" r="10" fill="none" stroke="${ring}" stroke-width="2"/>`,
    `<path d="M10 10.5h3.2l3 10.2 3-10.2H22.5l-4.7 13h-3.2L10 10.5Z" fill="${fill}"/>`,
    '</svg>'
  ].join('')

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = nativeImage.createFromDataURL(dataUrl).resize({ width: 16, height: 16 })
  image.setTemplateImage(false)
  return image
}
