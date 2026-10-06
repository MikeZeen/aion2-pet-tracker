<script setup>
import { computed } from 'vue'
import { useLiveWatcher } from '../composables/useLiveWatcher'
import { t } from '../i18n'

const { state } = useLiveWatcher()

const status = computed(() => {
  switch (state.status) {
    case 'idle':
      return { title: t('hud.starting'), hint: t('hud.startingHint') }
    case 'listening':
      return { title: t('hud.waiting'), hint: t('hud.waitingHint') }
    case 'error':
      return { title: t('hud.error', { error: state.error }), hint: t('hud.errorHint') }
    default:
      return null
  }
})
</script>

<template>
  <Transition name="status">
    <div v-if="status" class="hud-status" :class="state.status">
      <span class="dot" />
      <div class="body">
        <div class="title">{{ status.title }}</div>
        <div class="hint">{{ status.hint }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.hud-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 280px;
  padding: 0.4rem 0.7rem;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(var(--hud-box, 18, 20, 26), var(--hud-opacity, 0.6));
  border: 1px solid rgba(var(--tint, 255, 255, 255), 0.25);
  border-radius: 0.6rem;
  backdrop-filter: blur(8px);
  font-size: 0.8rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}

.hud-status.error {
  border-color: rgba(255, 130, 140, 0.5);
}

.dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f3d98b;
  animation: pulse 1.4s ease-in-out infinite;
}

.error .dot {
  background: #ff828c;
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.body {
  min-width: 0;
}

.hint {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
}

.status-enter-active,
.status-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.status-enter-from,
.status-leave-to {
  transform: translateX(110%);
  opacity: 0;
}
</style>
