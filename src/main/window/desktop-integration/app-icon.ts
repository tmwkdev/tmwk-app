import { dirname, resolve } from 'node:path'
import { app, BrowserWindow, nativeImage } from 'electron'
import tmwkIcon from '../../../../resources/tmwk-brand/icon.png?asset'
import tmwkMacDockIcon from '../../../../resources/tmwk-brand/icon.png?asset&asarUnpack'
import classicIcon from '../../../../resources/icon.png?asset'
import classicDevIcon from '../../../../resources/icon-dev.png?asset'
import classicDevMacIcon from '../../../../resources/icon-dev-mac.png?asset'
import watercolorIcon from '../../../../resources/app-icons/orca-watercolor.png?asset'
import watercolorMacIcon from '../../../../resources/app-icons/orca-watercolor-mac.png?asset'
import watercolorMacDockIcon from '../../../../resources/app-icons/orca-watercolor-mac.png?asset&asarUnpack'
import blueIcon from '../../../../resources/app-icons/orca-blue.png?asset'
import blueMacDockIcon from '../../../../resources/app-icons/orca-blue.png?asset&asarUnpack'
import {
  CUSTOM_APP_ICON_ID,
  DEFAULT_APP_ICON_ID,
  normalizeAppIconId,
  type BuiltInAppIconId
} from '../../../shared/app-lifecycle/identity/app-icon'
import { getCustomAppIconPath, getCustomAppIconRevision, hasCustomAppIcon } from './custom-app-icon'
import { fitAppIconToPlatformShape } from './platform-app-icon-shape'
import {
  defaultExecFile,
  runBoundedMacDockIconCommand,
  type ExecFile
} from './mac-dock-icon-command'

const isMac = process.platform === 'darwin'

// The -mac variants sit in Apple's 824/1024 icon tile; Windows and Linux keep their larger tiles (#5357).
const APP_ICON_PATHS = {
  tmwk: tmwkIcon,
  classic: app.isPackaged ? classicIcon : isMac ? classicDevMacIcon : classicDevIcon,
  watercolor: isMac ? watercolorMacIcon : watercolorIcon,
  blue: blueIcon
} satisfies Record<BuiltInAppIconId, string>

const MAC_DOCK_ICON_PATHS = {
  tmwk: tmwkMacDockIcon,
  watercolor: watercolorMacDockIcon,
  blue: blueMacDockIcon
} satisfies Record<Exclude<BuiltInAppIconId, 'classic'>, string>

type PersistMacDockIconOptions = {
  appBundlePath?: string
  execFile?: ExecFile
  isDevApp?: boolean
  platform?: NodeJS.Platform
}

const MAC_DOCK_ICON_SCRIPT = [
  'use framework "AppKit"',
  'use scripting additions',
  'set appPath to system attribute "ORCA_APP_BUNDLE_PATH"',
  'set iconPath to system attribute "ORCA_APP_ICON_PATH"',
  "set image to current application's NSImage's alloc()'s initWithContentsOfFile:iconPath",
  'if image is missing value then error "Orca app icon image could not be loaded"',
  "set ok to current application's NSWorkspace's sharedWorkspace()'s setIcon:image forFile:appPath options:0",
  'if ok is false then error "Orca app icon could not be persisted"'
]

const MAC_DOCK_ICON_CLEAR_SCRIPT = [
  'use framework "AppKit"',
  'use scripting additions',
  'set appPath to system attribute "ORCA_APP_BUNDLE_PATH"',
  "set ok to current application's NSWorkspace's sharedWorkspace()'s setIcon:(missing value) forFile:appPath options:0",
  'if ok is false then error "Orca app icon could not be cleared"'
]

let macDockIconPersistenceGeneration = 0
let macDockIconPersistenceQueue = Promise.resolve()

export function getAppIconPath(value: unknown): string {
  const iconId = normalizeAppIconId(value)
  if (iconId === CUSTOM_APP_ICON_ID) {
    // A missing import (removed file, copied settings) falls back instead of showing a blank tile.
    return hasCustomAppIcon() ? getCustomAppIconPath() : APP_ICON_PATHS[DEFAULT_APP_ICON_ID]
  }
  return APP_ICON_PATHS[iconId]
}

let customAppIconImageCache: { revision: number; image: Electron.NativeImage } | null = null

export function createAppIconImage(value: unknown): Electron.NativeImage {
  const iconPath = getAppIconPath(value)
  // Built-in assets already follow each platform's icon shape; only imported art needs fitting.
  if (iconPath !== getCustomAppIconPath()) {
    return nativeImage.createFromPath(iconPath)
  }
  const revision = getCustomAppIconRevision()
  if (customAppIconImageCache?.revision !== revision) {
    // Shaping is a full-size pixel pass, so run it once per imported file.
    const image = fitAppIconToPlatformShape(nativeImage.createFromPath(iconPath))
    customAppIconImageCache = { revision, image }
  }
  return customAppIconImageCache.image
}

function getMacAppBundlePath(): string | undefined {
  const appBundlePath = resolve(dirname(app.getPath('exe')), '..', '..')
  return appBundlePath.endsWith('.app') ? appBundlePath : undefined
}

function runMacCustomIconCommand(
  execFile: ExecFile,
  appBundlePath: string,
  iconPath: string
): Promise<boolean> {
  return runBoundedMacDockIconCommand({
    args: MAC_DOCK_ICON_SCRIPT.flatMap((line) => ['-e', line]),
    execFile,
    file: '/usr/bin/osascript',
    onError: (error) => {
      console.warn('[app-icon] failed to persist macOS dock icon:', error)
    },
    options: {
      env: {
        ...process.env,
        ORCA_APP_BUNDLE_PATH: appBundlePath,
        ORCA_APP_ICON_PATH: iconPath
      }
    },
    timeoutWarning: '[app-icon] timed out persisting macOS dock icon'
  })
}

function handleMacDockIconQueueError(error: unknown): void {
  console.warn('[app-icon] failed to persist macOS dock icon:', error)
}

function enqueueMacDockIconPersistence(work: () => Promise<void>): void {
  macDockIconPersistenceQueue = macDockIconPersistenceQueue
    .catch(handleMacDockIconQueueError)
    .then(work)
    .catch(handleMacDockIconQueueError)
}

function clearMacCustomIconMetadata(execFile: ExecFile, appBundlePath: string): Promise<boolean> {
  const clearAppKitIcon = (): Promise<boolean> => {
    return runBoundedMacDockIconCommand({
      args: MAC_DOCK_ICON_CLEAR_SCRIPT.flatMap((line) => ['-e', line]),
      execFile,
      file: '/usr/bin/osascript',
      onError: (error) => {
        console.warn('[app-icon] failed to clear macOS dock icon:', error)
      },
      options: {
        env: {
          ...process.env,
          ORCA_APP_BUNDLE_PATH: appBundlePath
        }
      },
      timeoutWarning: '[app-icon] timed out clearing macOS dock icon'
    })
  }

  const clearAttribute = (attribute: string): Promise<boolean> => {
    return runBoundedMacDockIconCommand({
      args: ['-d', attribute, appBundlePath],
      execFile,
      file: '/usr/bin/xattr',
      onError: (error) => {
        if (!error.message.includes('No such xattr')) {
          console.warn(`[app-icon] failed to clear macOS dock icon metadata ${attribute}:`, error)
        }
      },
      timeoutWarning: `[app-icon] timed out clearing macOS dock icon metadata ${attribute}`
    })
  }

  return clearAppKitIcon().then((cleared) =>
    Promise.all([
      clearAttribute('com.apple.FinderInfo'),
      clearAttribute('com.apple.ResourceFork')
    ]).then(() => cleared)
  )
}

export function persistMacDockIcon(value: unknown, options: PersistMacDockIconOptions = {}): void {
  const platform = options.platform ?? process.platform
  const isDevApp = options.isDevApp ?? !app.isPackaged
  if (platform !== 'darwin' || isDevApp) {
    return
  }
  const appBundlePath = options.appBundlePath ?? getMacAppBundlePath()
  if (!appBundlePath) {
    return
  }
  const execFile = options.execFile ?? defaultExecFile
  const iconId = normalizeAppIconId(value)
  const generation = ++macDockIconPersistenceGeneration
  enqueueMacDockIconPersistence(async () => {
    if (generation !== macDockIconPersistenceGeneration) {
      return
    }
    if (iconId === 'classic') {
      const cleared = await clearMacCustomIconMetadata(execFile, appBundlePath)
      // Empty image reaches AppKit as nil, so the Dock draws the sharp bundle icns once no custom icon remains.
      if (cleared && generation === macDockIconPersistenceGeneration) {
        app.dock?.setIcon(nativeImage.createEmpty())
      }
      return
    }
    if (iconId === CUSTOM_APP_ICON_ID) {
      // Imported icons never touch the signed bundle; only clear what an earlier built-in choice wrote.
      await clearMacCustomIconMetadata(execFile, appBundlePath)
      return
    }
    // Finder metadata supplies the stopped app’s Dock icon; Electron only changes the live tile.
    await runMacCustomIconCommand(execFile, appBundlePath, MAC_DOCK_ICON_PATHS[iconId])
  })
}

export function applyAppIcon(value: unknown): void {
  const image = createAppIconImage(value)
  if (image.isEmpty()) {
    return
  }
  if (process.platform === 'darwin') {
    app.dock?.setIcon(image)
  }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.setIcon(image)
    }
  }
  persistMacDockIcon(value)
}
