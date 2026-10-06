<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useLiveWatcher } from '../composables/useLiveWatcher'
import { OPACITY_MAX, OPACITY_MIN, SIZES, TINTS, useSettings } from '../composables/useSettings'
import { useSoulCounts } from '../composables/useSoulCounts'
import { useToasts } from '../composables/useToasts'
import { LANGUAGES, t } from '../i18n'

const { state: watcher } = useLiveWatcher()
const { state: settings, apply } = useSettings()

const draft = reactive({ ...pickDraft() })

function pickDraft() {
  return { size: settings.size, tint: settings.tint, opacity: settings.opacity, language: settings.language }
}

watch(
  () => [draft.size, draft.tint, draft.opacity, draft.language],
  () => {
    const changed = apply({ ...draft })
    if (changed.length) showPreview()
  },
)

const diagnosing = ref(false)
const diagnostics = ref('')

async function runDiagnostics() {
  if (!window.aion2Watcher?.diagnose) return
  diagnosing.value = true
  diagnostics.value = ''
  try {
    diagnostics.value = await window.aion2Watcher.diagnose()
  } catch (err) {
    diagnostics.value = String(err)
  } finally {
    diagnosing.value = false
  }
}

async function copyDiagnostics() {
  try {
    await navigator.clipboard.writeText(diagnostics.value)
    useToasts().pushToast(t('toast.copied'), 'success')
  } catch {
    useToasts().pushToast(t('toast.copyFailed', { path: '%LOCALAPPDATA%\\aion2-pet-tracker\\diagnostics.txt' }), 'error')
  }
}

const confirmingClear = ref(false)
let clearTimer = null

function clearProgress() {
  if (!confirmingClear.value) {
    confirmingClear.value = true
    clearTimer = setTimeout(() => (confirmingClear.value = false), 3000)
    return
  }
  clearTimeout(clearTimer)
  confirmingClear.value = false
  useSoulCounts().clearAll()
  useToasts().pushToast(t('toast.cleared'), 'info')
}

function closeSettings() {
  window.aion2Overlay?.setMode('toast')
}

// One live preview toast while adjusting the look.
function showPreview() {
  const { toasts, pushSoulToast } = useToasts()
  if (toasts.some((toast) => toast.preview)) return
  const { petInfo } = useSoulCounts()
  pushSoulToast({
    ...petInfo('Jellofi_01'),
    before: 11,
    after: 12,
    max: 25,
    label: t('gain.preview'),
    level: t('level.n', { n: 1 }),
    milestone: false,
    preview: true,
  })
}

const statusText = computed(() => {
  switch (watcher.status) {
    case 'listening':
      return t('settings.listening')
    case 'ready':
      return t('settings.ready')
    case 'error':
      return watcher.error || t('settings.stopped')
    default:
      return t('settings.idle')
  }
})
</script>

<template>
  <div class="panel settings">
    <h3>{{ t('settings.title') }}</h3>

    <p class="status" :class="watcher.status">
      <span class="dot" />
      {{ statusText }}
    </p>

    <label class="field">
      <span class="label">{{ t('settings.language') }}</span>
      <select v-model="draft.language" class="select">
        <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.label }}</option>
      </select>
    </label>

    <div class="field">
      <span class="label">{{ t('settings.size') }}</span>
      <div class="segmented">
        <button
          v-for="size in SIZES"
          :key="size.id"
          :class="{ selected: draft.size === size.id }"
          @click="draft.size = size.id"
        >
          {{ t(`size.${size.id}`) }}
        </button>
      </div>
    </div>

    <div class="field">
      <span class="label">{{ t('settings.color') }}</span>
      <div class="swatches">
        <button
          v-for="tint in TINTS"
          :key="tint.id"
          class="swatch"
          :class="{ selected: draft.tint === tint.id }"
          :style="{ '--swatch': tint.rgb }"
          :title="t(`tint.${tint.id}`)"
          @click="draft.tint = tint.id"
        />
      </div>
    </div>

    <label class="field">
      <span class="label">{{ t('settings.opacity') }} <span class="value">{{ draft.opacity }}%</span></span>
      <input v-model="draft.opacity" class="slider" type="range" :min="OPACITY_MIN" :max="OPACITY_MAX" step="5" />
    </label>

    <div class="field">
      <span class="label">{{ t('settings.network') }}</span>
      <p class="hint">{{ t('settings.networkHint') }}</p>
      <button class="diagnose" :disabled="diagnosing" @click="runDiagnostics">
        {{ t(diagnosing ? 'settings.diagnosing' : 'settings.diagnose') }}
      </button>
      <template v-if="diagnostics">
        <pre class="report">{{ diagnostics }}</pre>
        <button class="diagnose" @click="copyDiagnostics">{{ t('settings.copyReport') }}</button>
      </template>
    </div>

    <div class="actions">
      <button class="clear" :class="{ confirming: confirmingClear }" @click="clearProgress">
        {{ t(confirmingClear ? 'settings.clearConfirm' : 'settings.clear') }}
      </button>
      <button class="apply" @click="closeSettings">{{ t('settings.done') }}</button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--panel);
}

.panel h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.field {
  display: block;
  margin-top: 1rem;
}

.value {
  float: right;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.field input.slider {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  accent-color: rgb(var(--tint-hl, 255, 255, 255));
}

.select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.segmented {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  overflow: hidden;
}

.segmented button {
  flex: 1;
  padding: 0.35rem 0;
  border: none;
  border-right: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.segmented button:last-child {
  border-right: none;
}

.segmented button.selected {
  background: var(--accent);
  color: var(--text);
  font-weight: 600;
}

.swatches {
  display: flex;
  gap: 0.5rem;
}

.swatch {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid rgba(var(--swatch), 0.6);
  border-radius: 50%;
  background: rgba(var(--swatch), 0.35);
  cursor: pointer;
}

.swatch.selected {
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.35),
    0 0 0 4px rgba(var(--swatch), 0.9);
}

.label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.75rem;
  color: var(--muted);
}

.field input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg);
  color: var(--text);
}

.status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.6rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
}

.listening .dot {
  background: #e0a84e;
}

.ready .dot {
  background: #4caf6e;
}

.error .dot {
  background: #e05252;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.apply {
  padding: 0.4rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.hint {
  margin: 0.25rem 0 0.4rem;
  font-size: 0.75rem;
  color: var(--muted);
}

.diagnose {
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.diagnose:disabled {
  opacity: 0.6;
  cursor: default;
}

.report {
  max-height: 12rem;
  overflow: auto;
  margin: 0.5rem 0;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: rgba(0, 0, 0, 0.35);
  font-size: 0.65rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.clear {
  margin-right: auto;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.clear.confirming {
  border-color: #c0392b;
  color: #ff9b8a;
}

.apply:hover {
  filter: brightness(1.25);
}
</style>
