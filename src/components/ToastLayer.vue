<script setup>
import { useToasts } from '../composables/useToasts'

const { toasts } = useToasts()

function pct(count, max) {
  if (!max) return 0
  return Math.min(100, (count / max) * 100)
}

function hideBrokenIcon(event) {
  event.target.style.visibility = 'hidden'
}
</script>

<template>
  <TransitionGroup tag="div" name="toast" class="toast-layer">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="[t.type, t.kind, { complete: t.type === 'soul' && t.milestone }]"
    >
      <template v-if="t.type === 'soul'">
        <img v-if="t.icon" class="icon" :src="t.icon" alt="" @error="hideBrokenIcon" />
        <div class="body">
          <div class="label">
            {{ t.label }} · {{ t.level }}
            <span v-if="t.debug" class="debug-tag">debug</span>
          </div>
          <div class="name">{{ t.name }}</div>
          <div class="progress-row">
            <div class="bar">
              <div
                class="fill"
                :style="{ '--from': pct(t.before, t.max) + '%', '--to': pct(t.after, t.max) + '%' }"
              />
            </div>
            <span class="count">{{ t.after }} / {{ t.max }}</span>
          </div>
        </div>
      </template>
      <template v-else>{{ t.text }}</template>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toast-layer {
  --glass: rgba(var(--hud-box, 18, 20, 26), var(--hud-opacity, 0.6));
  --edge: rgba(var(--tint, 255, 255, 255), 0.28);
  --text: rgba(255, 255, 255, 0.95);
  --muted: rgba(255, 255, 255, 0.7);
  --fill: rgba(var(--tint-hl, 255, 255, 255), 0.85);
  --gold: #f3d98b;

  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
}

.toast {
  position: relative;
  width: 100%;
  max-width: 280px;
  color: var(--text);
  background: var(--glass);
  border: 1px solid var(--edge);
  border-radius: 0.6rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  font-size: 0.8rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}

.toast.text {
  padding: 0.4rem 0.7rem;
}

.toast.error {
  border-color: rgba(255, 130, 140, 0.5);
}

.toast.soul {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.65rem;
}

.toast.soul.complete {
  border-color: rgba(243, 217, 139, 0.55);
}

.icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--edge);
  background: rgba(var(--tint, 255, 255, 255), 0.08);
  object-fit: cover;
  object-position: center top;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.complete .icon {
  border-color: rgba(243, 217, 139, 0.7);
}

.body {
  flex: 1;
  min-width: 0;
}

.label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.complete .label {
  color: var(--gold);
}

.debug-tag {
  margin-left: 0.3rem;
  padding: 0 0.25rem;
  border-radius: 3px;
  border: 1px solid var(--edge);
  letter-spacing: 0.05em;
}

.name {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.25rem;
}

.bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: rgba(var(--tint-hl, 255, 255, 255), 0.2);
  overflow: hidden;
}

.fill {
  height: 100%;
  width: var(--to);
  border-radius: 2px;
  background: var(--fill);
  animation: fill 0.8s ease-out 0.3s both;
}

.complete .fill {
  background: var(--gold);
}

@keyframes fill {
  from {
    width: var(--from);
  }
  to {
    width: var(--to);
  }
}

.count {
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  color: var(--muted);
}

.toast-enter-active {
  transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.35s ease-out;
}

.toast-leave-active {
  transition: transform 0.3s ease-in, opacity 0.3s ease-in;
  position: absolute;
  right: 0;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateX(110%);
  opacity: 0;
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
