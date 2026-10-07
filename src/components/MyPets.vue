<script setup>
import { computed, ref } from 'vue'
import { isLearnedPet } from '../composables/useMonsterPets'
import { levelLabel, MAX_TOTAL, progressOf, useSoulCounts } from '../composables/useSoulCounts'
import { englishPetName, PET_CODES, t } from '../i18n'
import maps from '../data/maps.json'
import regionData from '../data/regions.json'

const { state: souls, petInfo } = useSoulCounts()

const FILTERS = ['all', 'progress', 'locked', 'maxed']
const query = ref('')
const filter = ref('all')
const sort = ref('progress')
const expanded = ref(null)

// Pet code -> area names, from the regions and the maps known only as a whole.
const AREAS = (() => {
  const areas = {}
  const add = (code, name) => (areas[code] ??= new Set()).add(name)
  for (const [name, region] of Object.entries(regionData.regions)) region.pets.forEach((code) => add(code, name))
  for (const [map, pets] of Object.entries(regionData.mapPets)) {
    const name = Object.values(maps).find((m) => m.map === map)?.name ?? map
    pets.forEach((code) => add(code, name))
  }
  return Object.fromEntries(Object.entries(areas).map(([code, names]) => [code, [...names].sort()]))
})()

const allPets = computed(() =>
  PET_CODES.map((code) => {
    const total = souls[code]?.total ?? 0
    const progress = progressOf(total)
    return { code, total, ...petInfo(code), ...progress, levelText: levelLabel(progress.level) }
  }),
)

const summary = computed(() => ({
  unlocked: allPets.value.filter((p) => p.level > 0).length,
  maxed: allPets.value.filter((p) => p.maxed).length,
  total: allPets.value.length,
}))

function matchesFilter(p) {
  switch (filter.value) {
    case 'progress':
      return !p.maxed && p.total > 0
    case 'locked':
      return p.level === 0
    case 'maxed':
      return p.maxed
    default:
      return true
  }
}

// Matches the current language's name or the English one.
const pets = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allPets.value
    .filter((p) => matchesFilter(p))
    .filter((p) => !q || p.name.toLowerCase().includes(q) || englishPetName(p.code).toLowerCase().includes(q))
    .sort((a, b) =>
      sort.value === 'name' ? a.name.localeCompare(b.name) : b.total - a.total || a.name.localeCompare(b.name),
    )
})

function sourcesOf(code) {
  const areas = AREAS[code] ?? []
  return { areas, learned: !areas.length && isLearnedPet(code) }
}

function toggle(code) {
  expanded.value = expanded.value === code ? null : code
}

function hideBrokenIcon(event) {
  event.target.style.visibility = 'hidden'
}
</script>

<template>
  <div class="panel my-pets">
    <h3>{{ t('pets.title') }}</h3>
    <p class="hint">{{ t('pets.summary', summary) }}</p>

    <input v-model="query" class="search" type="search" :placeholder="t('pets.search')" />

    <div class="controls">
      <div class="segmented">
        <button v-for="f in FILTERS" :key="f" :class="{ selected: filter === f }" @click="filter = f">
          {{ t(`pets.filter.${f}`) }}
        </button>
      </div>
      <select v-model="sort" class="select">
        <option value="progress">{{ t('pets.sort.progress') }}</option>
        <option value="name">{{ t('pets.sort.name') }}</option>
      </select>
    </div>

    <div class="list">
      <div v-for="p in pets" :key="p.code" class="entry" :class="{ open: expanded === p.code }">
        <button class="pet" :class="{ maxed: p.maxed, locked: p.level === 0 }" @click="toggle(p.code)">
          <img v-if="p.icon" class="portrait" :src="p.icon" alt="" @error="hideBrokenIcon" />
          <span class="name">{{ p.name }}</span>
          <span class="level">{{ p.levelText }}</span>
          <span class="bar"><span class="fill" :style="{ width: (p.count / p.needed) * 100 + '%' }" /></span>
          <span class="count">{{ p.count }}/{{ p.needed }}</span>
        </button>
        <div v-if="expanded === p.code" class="details">
          <div>{{ t('pets.totalSouls', { n: p.total, max: MAX_TOTAL }) }}</div>
          <div class="label">{{ t('pets.areas') }}</div>
          <div v-if="sourcesOf(p.code).areas.length" class="areas">
            <span v-for="area in sourcesOf(p.code).areas" :key="area" class="area">{{ area }}</span>
          </div>
          <div v-else class="muted">{{ t(sourcesOf(p.code).learned ? 'pets.learned' : 'pets.noArea') }}</div>
        </div>
      </div>
      <p v-if="!pets.length" class="muted empty">{{ t('pets.empty') }}</p>
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
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.hint {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.search,
.select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.search {
  width: 100%;
  box-sizing: border-box;
}

.controls {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.segmented {
  display: flex;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  overflow: hidden;
}

.segmented button {
  flex: 1;
  padding: 0.3rem 0;
  border: none;
  border-right: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
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

.list {
  max-height: 22rem;
  overflow-y: auto;
}

.entry {
  border-bottom: 1px solid var(--border);
}

.pet {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.1rem;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.pet:hover,
.open .pet {
  background: var(--bg);
}

.locked {
  color: var(--muted);
}

.portrait {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  object-fit: cover;
  object-position: center top;
}

.locked .portrait {
  filter: grayscale(1);
  opacity: 0.6;
}

.name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.level {
  font-size: 0.7rem;
  color: var(--muted);
}

.bar {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: rgba(var(--tint-hl, 168, 112, 47), 0.85);
}

.maxed .fill {
  background: #f3d98b;
}

.count {
  min-width: 2.8rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  color: var(--muted);
}

.details {
  padding: 0.3rem 0.4rem 0.6rem 2.1rem;
  font-size: 0.75rem;
}

.label {
  margin-top: 0.4rem;
  font-size: 0.7rem;
  color: var(--muted);
}

.areas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}

.area {
  padding: 0.05rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 999px;
}

.muted {
  color: var(--muted);
}

.empty {
  margin: 0.75rem 0;
  font-size: 0.8rem;
  text-align: center;
}
</style>
