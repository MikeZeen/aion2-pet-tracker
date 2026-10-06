import { reactive, watch } from 'vue'
import { useDebugMode } from './useDebugMode'
import { useToasts } from './useToasts'
import { t } from '../i18n'

// "owner/name" of the GitHub repository whose releases are checked. Empty disables the check.
const GITHUB_REPO = ''
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const TOAST_MS = 10_000

export const CURRENT_VERSION = __APP_VERSION__

const state = reactive({
  latest: null, // { version, url, notes }
  dismissed: false,
})

let timer = null
let real = null

function parseVersion(tag) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(tag))
  return match ? match.slice(1).map(Number) : null
}

function isNewer(tag, current) {
  const a = parseVersion(tag)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

function announce(release) {
  const isNew = state.latest?.version !== release?.version
  state.latest = release
  if (!release || !isNew) return
  state.dismissed = false
  useToasts().pushToast(t('update.toast', { version: release.version }), 'info', TOAST_MS)
}

async function fetchLatest() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return null
  const release = await res.json()
  if (!isNewer(release.tag_name, CURRENT_VERSION)) return null
  return {
    version: String(release.tag_name).replace(/^v/, ''),
    url: release.html_url,
    notes: (release.body ?? '').trim(),
  }
}

async function check() {
  if (!GITHUB_REPO) return
  try {
    real = await fetchLatest()
  } catch {
    return // offline or rate-limited; try again next interval
  }
  if (!useDebugMode().enabled.value) announce(real)
}

function fakeRelease() {
  const [major, minor] = parseVersion(CURRENT_VERSION) ?? [0, 0]
  return {
    version: `${major}.${minor + 1}.0`,
    url: 'https://github.com',
    notes: 'Debug mode: fake release for testing the update prompt.\n\n- New feature\n- Bug fixes',
  }
}

export function useUpdates() {
  function start() {
    if (timer) return
    check()
    timer = setInterval(check, CHECK_INTERVAL_MS)
    // Debug mode stands in for a newer release on GitHub.
    watch(useDebugMode().enabled, (on) => announce(on ? fakeRelease() : real), { immediate: true })
  }

  function download() {
    if (!state.latest) return
    if (window.aion2Overlay) window.aion2Overlay.openUrl(state.latest.url)
    else window.open(state.latest.url, '_blank', 'noopener')
  }

  function dismiss() {
    state.dismissed = true
  }

  return { state, start, download, dismiss }
}
