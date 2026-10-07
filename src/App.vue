<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import HudStatus from './components/HudStatus.vue'
import ItemDictionary from './components/ItemDictionary.vue'
import LocationPets from './components/LocationPets.vue'
import MyPets from './components/MyPets.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ToastLayer from './components/ToastLayer.vue'
import UpdateDialog from './components/UpdateDialog.vue'
import { useDebugMode } from './composables/useDebugMode'
import { useLiveWatcher } from './composables/useLiveWatcher'
import { useSettings } from './composables/useSettings'
import { CURRENT_VERSION, useUpdates } from './composables/useUpdates'
import { PET_CODES, petName, t } from './i18n'

const overlay = window.aion2Overlay
const mode = ref(overlay ? 'toast' : 'settings')
const debug = useDebugMode()
const unsubscribers = []

const { state: settings, hudScale } = useSettings()
const watcher = useLiveWatcher()

watch(hudScale, (scale) => overlay?.setHudScale(scale), { immediate: true })

// The watcher runs whenever the overlay is in toast mode; (re)started on launch
// and when leaving Settings.
function ensureScanning() {
  if (!overlay || mode.value !== 'toast') return
  if (watcher.state.status === 'idle' || watcher.state.status === 'error') {
    watcher.start(settings.character, settings.iface || undefined)
  }
}

watch(mode, ensureScanning)

onMounted(async () => {
  useUpdates().start()
  if (!overlay) return
  unsubscribers.push(overlay.onMode((next) => (mode.value = next)))
  unsubscribers.push(overlay.onTestToast(debug.testToast))
  mode.value = await overlay.getMode()
  ensureScanning()
})

onUnmounted(() => unsubscribers.forEach((off) => off()))
</script>

<template>
  <div class="app" :class="`mode-${mode}`">
    <template v-if="mode === 'settings'">
      <div v-if="overlay" class="titlebar" data-tauri-drag-region>
        <span class="titlebar-name" data-tauri-drag-region>
          Aion 2 Pet Tracker <span class="version">v{{ CURRENT_VERSION }}</span>
        </span>
        <label
          v-if="debug.available"
          class="debug-switch"
          :class="{ on: debug.enabled.value }"
          title="Fake soul toasts every 10s, fake location every 30s, Ctrl+Shift+T test toast"
        >
          <input v-model="debug.enabled.value" type="checkbox" />
          Debug mode
        </label>
        <div class="titlebar-buttons">
          <button :title="t('app.backToOverlay')" @click="overlay.setMode('toast')">–</button>
          <button :title="t('app.close')" class="close" @click="overlay.close()">×</button>
        </div>
      </div>

      <div class="content">
        <header v-if="!overlay">
          <h1>Aion 2 Pet Tracker</h1>
          <p class="subtitle">{{ t('app.browserNote') }}</p>
        </header>

        <SettingsPanel />
        <ItemDictionary />
        <MyPets />
      </div>

      <UpdateDialog />
    </template>

    <div class="hud">
      <ToastLayer />
      <HudStatus v-if="overlay && mode === 'toast'" />
      <LocationPets v-if="mode === 'toast'" />
    </div>

    <datalist id="pet-options">
      <option v-for="code in PET_CODES" :key="code" :value="petName(code)" />
    </datalist>
  </div>
</template>

<style scoped>
.app {
  max-width: 64rem;
  margin: 0 auto;
}

.content {
  padding: 2rem 1rem 4rem;
}

:global(html.overlay .app) {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

:global(html.overlay .content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}

.hud {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 100%;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  pointer-events: none;
  z-index: 100;
  transform: scale(var(--hud-scale, 1));
  transform-origin: bottom right;
}

.section-label {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.titlebar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 0.75rem 0;
  padding: 0.35rem 0.5rem 0.35rem 0.75rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  font-size: 0.85rem;
  user-select: none;
}

.titlebar-name {
  flex: 1;
  font-weight: 600;
}

.version {
  margin-left: 0.25rem;
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--muted);
}

.debug-switch {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--muted);
  cursor: pointer;
}

.debug-switch.on {
  color: #ffd27a;
  border-color: rgba(255, 210, 122, 0.5);
}

.debug-switch input {
  margin: 0;
}

.titlebar-buttons {
  display: flex;
  gap: 0.25rem;
}

.titlebar-buttons button {
  width: 1.75rem;
  height: 1.5rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.titlebar-buttons button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.titlebar-buttons .close:hover {
  background: #c0392b;
}

header {
  margin-bottom: 1.5rem;
}

header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
}

.subtitle {
  margin: 0;
  color: var(--muted);
}
</style>
