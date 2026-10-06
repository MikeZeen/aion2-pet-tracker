import { reactive, watch } from 'vue'
import { isKnownPet, petName, t } from '../i18n'

const STORAGE_KEY = 'aion2-pet-tracker-soul-counts'

// Souls needed per level: 5 unlocks the pet, then 25 for Lv 2 and 75 for Lv 3.
export const STAGES = [5, 25, 75]
export const MAX_TOTAL = STAGES.reduce((a, b) => a + b, 0)
const MILESTONE_KEYS = ['gain.unlocked', 'gain.level2', 'gain.max']

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

// { [petCode]: { total } }
const state = reactive(loadState())

watch(
  state,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // storage unavailable
    }
  },
  { deep: true },
)

export function progressOf(total) {
  let remaining = Math.max(0, total)
  for (let level = 0; level < STAGES.length; level++) {
    if (remaining < STAGES[level]) return { level, count: remaining, needed: STAGES[level], maxed: false }
    remaining -= STAGES[level]
  }
  const last = STAGES[STAGES.length - 1]
  return { level: STAGES.length, count: last, needed: last, maxed: true }
}

export function levelLabel(level) {
  if (level === 0) return t('level.locked')
  if (level >= STAGES.length) return t('level.max')
  return t('level.n', { n: level })
}

// Crossing a level shows the completed stage (5/5 "Pet unlocked!") instead of 0/25.
export function describeGain(totalBefore, totalAfter) {
  const before = progressOf(totalBefore)
  const after = progressOf(totalAfter)

  if (after.level > before.level) {
    const milestone = after.level - 1
    const needed = STAGES[milestone]
    return {
      before: before.level === milestone ? before.count : 0,
      after: needed,
      max: needed,
      label: t(MILESTONE_KEYS[milestone]),
      milestone: true,
      level: levelLabel(after.level),
    }
  }

  return {
    before: before.count,
    after: after.count,
    max: after.needed,
    label: t(after.maxed ? 'gain.alreadyMax' : 'gain.obtained'),
    milestone: false,
    level: levelLabel(after.level),
  }
}

function ensure(petCode) {
  if (!state[petCode]) state[petCode] = { total: 0 }
  return state[petCode]
}

export function useSoulCounts() {
  function petInfo(petCode) {
    return {
      name: petName(petCode),
      icon: isKnownPet(petCode) ? `${import.meta.env.BASE_URL}portraits/${petCode}.webp` : null,
    }
  }

  function add(petCode, amount = 1) {
    const entry = ensure(petCode)
    const before = entry.total
    entry.total = Math.min(MAX_TOTAL, before + amount)
    return describeGain(before, entry.total)
  }

  // Level plus the souls collected within that level, as the game reports it.
  function setProgress(petCode, level, count) {
    const entry = ensure(petCode)
    const lvl = Math.max(0, Math.min(STAGES.length, Number(level) || 0))
    const completed = STAGES.slice(0, lvl).reduce((a, b) => a + b, 0)
    const inStage = lvl < STAGES.length ? Math.max(0, Math.min(STAGES[lvl] - 1, Number(count) || 0)) : 0
    entry.total = completed + inStage
  }

  function clearAll() {
    for (const code of Object.keys(state)) delete state[code]
  }

  return { state, petInfo, add, setProgress, clearAll }
}
