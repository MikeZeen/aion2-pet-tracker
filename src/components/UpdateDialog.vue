<script setup>
import { CURRENT_VERSION, useUpdates } from '../composables/useUpdates'
import { t } from '../i18n'

const { state, download, dismiss } = useUpdates()
</script>

<template>
  <Transition name="fade">
    <div v-if="state.latest && !state.dismissed" class="backdrop" @click.self="dismiss">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3>{{ t('update.title') }}</h3>
        <p class="versions">{{ t('update.body', { version: state.latest.version, current: CURRENT_VERSION }) }}</p>
        <pre v-if="state.latest.notes" class="notes">{{ state.latest.notes }}</pre>
        <div class="actions">
          <button class="later" @click="dismiss">{{ t('update.later') }}</button>
          <button class="download" @click="download">{{ t('update.download') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.45);
}

.dialog {
  width: 100%;
  max-width: 22rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.versions {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.notes {
  max-height: 10rem;
  overflow: auto;
  margin: 0.75rem 0 0;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: rgba(0, 0, 0, 0.25);
  font-family: inherit;
  font-size: 0.75rem;
  white-space: pre-wrap;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.actions button {
  padding: 0.4rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  cursor: pointer;
}

.later {
  background: transparent;
  color: var(--muted);
}

.later:hover {
  color: var(--text);
}

.download {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.download:hover {
  filter: brightness(1.25);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
