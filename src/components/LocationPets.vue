<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useDebugMode } from '../composables/useDebugMode'
import { useLiveWatcher } from '../composables/useLiveWatcher'
import { useLocation } from '../composables/useLocation'
import { levelLabel, progressOf, useSoulCounts } from '../composables/useSoulCounts'
import { t } from '../i18n'

const { live, areaName, locationName: liveLocationName, currentPets } = useLocation()
const { state: souls, petInfo } = useSoulCounts()
const { debugLocation } = useDebugMode()
const { state: watcher } = useLiveWatcher()

const fake = computed(() => debugLocation.value)
const locationName = computed(() => fake.value?.name ?? liveLocationName())
const entries = computed(() =>
  fake.value ? fake.value.pets : currentPets().map((code) => ({ code, total: souls[code]?.total ?? 0 })),
)

const allPets = computed(() =>
  entries.value
    .map(({ code, total }) => {
      const progress = progressOf(total)
      return { code, total, ...petInfo(code), ...progress, levelText: levelLabel(progress.level) }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
)
// Maxed pets are only counted, to keep the panel short.
const pets = computed(() => allPets.value.filter((p) => !p.maxed))
const maxedCount = computed(() => allPets.value.length - pets.value.length)

const title = computed(() => {
  const area = fake.value || live.mapId == null ? locationName.value : areaName()
  return area ? t('loc.petsIn', { area }) : t('loc.petsNearby')
})

const empty = computed(() => {
  if (fake.value || allPets.value.length || watcher.status !== 'ready') return null
  if (live.mapId == null) return { text: t('loc.finding'), hint: t('loc.findingHint') }
  if (areaName()) return { text: t('loc.noPets'), hint: t('loc.moveHint') }
  if (live.monsters.length) return { text: t('loc.unknownMonsters'), hint: t('loc.learnHint') }
  return { text: t('loc.noMonsters'), hint: t('loc.moveHint') }
})

// Longer lists auto-scroll one row per step; rendered twice to wrap around seamlessly.
const MAX_ROWS = 10
const STEP_MS = 3000
const scrolling = computed(() => pets.value.length > MAX_ROWS)
const rows = computed(() => (scrolling.value ? [...pets.value, ...pets.value] : pets.value))
const offset = ref(0)
const animate = ref(true)

watch(
  () => pets.value.map((p) => p.code).join(),
  () => {
    animate.value = false
    offset.value = 0
  },
)

const timer = setInterval(() => {
  if (!scrolling.value) return
  animate.value = true
  offset.value += 1
}, STEP_MS)
onUnmounted(() => clearInterval(timer))

function onScrolled() {
  if (offset.value >= pets.value.length) {
    animate.value = false
    offset.value = 0
  }
}

function hideBrokenIcon(event) {
  event.target.style.visibility = 'hidden'
}
</script>

<template>
  <div v-if="locationName && allPets.length" class="location-pets">
    <div class="title">
      {{ title }}
      <span v-if="fake" class="debug-tag">debug</span>
    </div>
    <div class="rows" :style="{ '--visible-rows': Math.min(pets.length, MAX_ROWS) }">
      <div
        class="track"
        :class="{ animate }"
        :style="{ transform: `translateY(calc(var(--row-height) * ${-offset}))` }"
        @transitionend="onScrolled"
      >
        <div v-for="(p, i) in rows" :key="`${p.code}-${i}`" class="pet" :class="{ maxed: p.maxed }">
          <img v-if="p.icon" class="portrait" :src="p.icon" alt="" @error="hideBrokenIcon" />
          <span class="name">{{ p.name }}</span>
          <span class="level">{{ p.levelText }}</span>
          <div class="bar"><div class="fill" :style="{ width: (p.count / p.needed) * 100 + '%' }" /></div>
          <span class="count">{{ p.count }}/{{ p.needed }}</span>
        </div>
      </div>
    </div>
    <div v-if="maxedCount" class="maxed-note">
      {{ pets.length ? '+' : '' }}{{ t(maxedCount === 1 ? 'loc.maxedOne' : 'loc.maxedMany', { n: maxedCount }) }}
    </div>
  </div>
  <div v-else-if="empty" class="location-pets">
    <div class="title">{{ title }}</div>
    <div>{{ empty.text }}</div>
    <div class="maxed-note">{{ empty.hint }}</div>
  </div>
</template>

<style scoped>
.location-pets {
  --row-height: 26px;
  width: 100%;
  max-width: 280px;
  padding: 0.4rem 0.6rem;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(var(--hud-box, 18, 20, 26), var(--hud-opacity, 0.6));
  border: 1px solid rgba(var(--tint, 255, 255, 255), 0.25);
  border-radius: 0.6rem;
  backdrop-filter: blur(8px);
  font-size: 0.75rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}

.maxed-note {
  margin-top: 0.2rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.6);
}

.title {
  margin-bottom: 0.25rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.7);
}

.debug-tag {
  margin-left: 0.3rem;
  padding: 0 0.25rem;
  border-radius: 3px;
  border: 1px solid rgba(var(--tint, 255, 255, 255), 0.22);
  letter-spacing: 0.05em;
}

.rows {
  height: calc(var(--row-height) * var(--visible-rows));
  overflow: hidden;
}

.track.animate {
  transition: transform 0.6s ease-in-out;
}

.pet {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: var(--row-height);
}

.portrait {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid rgba(var(--tint, 255, 255, 255), 0.22);
  object-fit: cover;
  object-position: center top;
}

.name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.level {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
}

.bar {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: rgba(var(--tint-hl, 255, 255, 255), 0.2);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: rgba(var(--tint-hl, 255, 255, 255), 0.85);
  transition: width 0.6s ease-out;
}

.maxed .fill {
  background: #f3d98b;
}

.count {
  min-width: 2.6rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.7);
}
</style>
