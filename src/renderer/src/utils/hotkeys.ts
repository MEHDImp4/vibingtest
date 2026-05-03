export function normalizeKeyName(key: string): string {
  if (key.length === 1) return key.toLowerCase()

  const aliases: Record<string, string> = {
    ' ': 'space',
    Spacebar: 'space',
    Control: 'ctrl',
    Shift: 'shift',
    Alt: 'alt',
    Meta: 'win',
    OS: 'win',
    Escape: 'escape',
    Esc: 'escape',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
  }

  return aliases[key] ?? key.toLowerCase()
}

export function normalizeHotkey(value: string): string {
  const aliases: Record<string, string> = {
    control: 'ctrl',
    ctl: 'ctrl',
    cmdorctrl: 'ctrl',
    commandorcontrol: 'ctrl',
    controlorcommand: 'ctrl',
    command: 'win',
    cmd: 'win',
    windows: 'win',
    meta: 'win',
    super: 'win',
    option: 'alt',
    alternate: 'alt',
    return: 'enter',
    esc: 'escape',
    del: 'delete'
  }

  const rawParts = value
    .replace(/-/g, '+')
    .split('+')
    .map((part: string) => part.trim().toLowerCase())
    .filter(Boolean)

  const parts = rawParts.map((part: string) => aliases[part] ?? part)
  const ordered = ['ctrl', 'shift', 'alt', 'win']
    .filter((modifier: string) => parts.includes(modifier))
    .concat(parts.filter((part: string) => !['ctrl', 'shift', 'alt', 'win'].includes(part)))

  return Array.from(new Set(ordered)).join('+')
}

export function isValidHotkey(value: string): boolean {
  const parts = normalizeHotkey(value).split('+').filter(Boolean)
  // Allow single keys if they are not just modifiers, OR allow combo with modifiers
  const hasNonModifier = parts.some((part) => !['ctrl', 'shift', 'alt', 'win'].includes(part))
  return parts.length > 0 && hasNonModifier
}

export function hotkeyFromKeyboardEvent(event: globalThis.KeyboardEvent): string {
  const key = normalizeKeyName(event.key)
  if (!key || ['ctrl', 'shift', 'alt', 'win'].includes(key)) return ''

  const parts = [
    event.ctrlKey ? 'ctrl' : '',
    event.shiftKey ? 'shift' : '',
    event.altKey ? 'alt' : '',
    event.metaKey ? 'win' : '',
    key
  ].filter(Boolean)

  if (parts.length < 1) return ''
  return parts.join('+')
}
