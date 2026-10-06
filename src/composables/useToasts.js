import { reactive } from 'vue'

const INFO_DURATION_MS = 5000
const SOUL_DURATION_MS = 6000
const MAX_VISIBLE = 3

const toasts = reactive([])
let seq = 0

function push(toast, durationMs) {
  const id = ++seq
  if (toasts.length >= MAX_VISIBLE) toasts.splice(0, toasts.length - MAX_VISIBLE + 1)
  toasts.push({ id, ...toast })
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }, durationMs)
}

export function useToasts() {
  function pushToast(text, kind = 'info', durationMs = INFO_DURATION_MS) {
    push({ type: 'text', text, kind }, durationMs)
  }

  function pushSoulToast({ name, icon, before, after, max, label, milestone, level, debug = false, preview = false }) {
    push({ type: 'soul', name, icon, before, after, max, label, milestone, level, debug, preview }, SOUL_DURATION_MS)
  }

  return { toasts, pushToast, pushSoulToast }
}
