import updater from 'electron-updater'
const { autoUpdater } = updater
import { dialog, app } from 'electron'
import log from 'electron-log'

let isManualCheck = false

export function setupUpdater(): void {
  if (!app.isPackaged) {
    console.log('[updater] Skipping setup in development')
    return
  }

  // Configure logging for updates
  autoUpdater.logger = log
  // @ts-expect-error logger is not typed correctly in older electron-log or updater
  autoUpdater.logger.transports.file.level = 'info'

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version)
    if (isManualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. It will be downloaded in the background.`
      })
      isManualCheck = false
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Update not available:', info.version)
    if (isManualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates',
        message: `VoxFlow is up to date (Version ${info.version}).`
      })
      isManualCheck = false
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error in auto-updater:', err)
    
    // Only show error dialog if the user manually triggered the check
    if (isManualCheck) {
      const is404 = err.message?.includes('404') || err.stack?.includes('404')
      if (is404) {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Update Check Failed',
          message: 'The update metadata (latest.yml) was not found on GitHub. Ensure you have uploaded all build artifacts to your release.',
          detail: 'URL: ' + (err.message.match(/https?:\/\/[^\s)]+/)?.[0] || 'Unknown')
        })
      } else {
        dialog.showErrorBox('Update Error', err.message || 'An error occurred while checking for updates.')
      }
    }
    // Always reset manual check flag on error
    isManualCheck = false
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const log_message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
    console.log('[updater]', log_message)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version)
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of VoxFlow has been downloaded. Restart the application to apply the update?',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  // Initial check
  autoUpdater.checkForUpdatesAndNotify()

  // Check for updates every 2 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 1000 * 60 * 60 * 2)
}

export async function manualCheckForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Development Mode',
      message: 'Update checks are disabled in development mode.'
    })
    return
  }

  isManualCheck = true
  await autoUpdater.checkForUpdatesAndNotify()
}
