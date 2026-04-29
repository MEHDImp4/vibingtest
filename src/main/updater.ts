import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'
import log from 'electron-log'

export function setupUpdater(): void {
  // Configure logging for updates
  autoUpdater.logger = log
  // @ts-expect-error logger is not typed correctly in older electron-log or updater
  autoUpdater.logger.transports.file.level = 'info'

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Update not available:', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error in auto-updater:', err)
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

  // Check for updates every 2 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 1000 * 60 * 60 * 2)

  // Initial check
  autoUpdater.checkForUpdatesAndNotify()
}

export async function manualCheckForUpdates(): Promise<void> {
  await autoUpdater.checkForUpdatesAndNotify()
}
