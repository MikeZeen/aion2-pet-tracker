<script setup>
import { useLiveWatcher } from '../composables/useLiveWatcher'
import { t } from '../i18n'

const { state: watcher, resolvePending, ignorePending } = useLiveWatcher()

function save(item) {
  item.invalid = !resolvePending(item)
}
</script>

<template>
  <div class="item-dictionary">
    <div v-if="watcher.pending.length" class="panel">
      <h3>{{ t('pending.title') }}</h3>
      <p class="hint">{{ t('pending.hint') }}</p>
      <div v-for="item in watcher.pending" :key="item.id" class="pending-item">
        <div class="pending-head">
          <span class="mono">{{ item.id }}</span>
          <span class="count">{{ t('pending.seen', { n: item.count }) }}</span>
        </div>
        <input
          v-model="item.nameInput"
          list="pet-options"
          :placeholder="t('pending.placeholder')"
          :class="{ invalid: item.invalid }"
          :title="item.invalid ? t('pending.invalid') : ''"
          @input="item.invalid = false"
          @keyup.enter="save(item)"
        />
        <button class="save" @click="save(item)">{{ t('pending.save') }}</button>
        <button class="no-pet" :title="t('pending.noPetTitle')" @click="ignorePending(item)">
          {{ t('pending.noPet') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-dictionary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--panel);
}

.hint {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.panel h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.pending-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
}

.pending-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
}

.pending-item .count {
  color: var(--muted);
  font-size: 0.75rem;
}

.pending-item input {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg);
  color: var(--text);
}

.save {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.save:hover {
  filter: brightness(1.25);
}

.pending-item input.invalid {
  border-color: #e05252;
}

.no-pet {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}

.no-pet:hover {
  color: var(--text);
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}

</style>
