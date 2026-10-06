import { ref, watch } from 'vue'
import { REGION_NAMES } from './useLocation'
import { describeGain, MAX_TOTAL, STAGES, useSoulCounts } from './useSoulCounts'
import { useToasts } from './useToasts'
import { DEV_TOOLS } from '../devTools'
import regionData from '../data/regions.json'

// Fake soul toasts and a fake location for testing the overlay without the game.
// Dev builds only; never touches real progress.
const STORAGE_KEY = 'aion2-pet-tracker-debug-mode'
const INTERVAL_MS = 10_000
const LOCATION_INTERVAL_MS = 30_000

const farmablePetCodes = [...new Set(Object.values(regionData.regions).flatMap((region) => region.pets))]
const MILESTONE_TOTALS = STAGES.map((_, i) => STAGES.slice(0, i + 1).reduce((a, b) => a + b, 0))

function loadEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const enabled = ref(DEV_TOOLS && loadEnabled())
const debugLocation = ref(null)
let timer = null
let locationTimer = null
let tick = 0

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function randomPet() {
  return farmablePetCodes[randomInt(0, farmablePetCodes.length - 1)]
}

// Cycles through a tracked pet's next soul, a random soul and each milestone.
function showSample() {
  const { state, petInfo } = useSoulCounts()
  const { pushSoulToast } = useToasts()
  const tracked = Object.keys(state)
  const step = tick++ % 3

  const useTracked = step === 0 && tracked.length
  const code = useTracked ? tracked[randomInt(0, tracked.length - 1)] : randomPet()

  let after
  if (useTracked) after = Math.min(MAX_TOTAL, state[code].total + 1)
  else if (step === 2) after = MILESTONE_TOTALS[Math.floor(tick / 3) % MILESTONE_TOTALS.length]
  else after = randomInt(1, MAX_TOTAL - 1)

  pushSoulToast({ ...petInfo(code), ...describeGain(after - 1, after), debug: true })
}

// Picks a level first so every level shows up about equally often.
function randomTotal() {
  const level = randomInt(0, STAGES.length)
  if (level === STAGES.length) return MAX_TOTAL
  return MILESTONE_TOTALS[level] - STAGES[level] + randomInt(0, STAGES[level] - 1)
}

function rollLocation() {
  const name = REGION_NAMES[randomInt(0, REGION_NAMES.length - 1)]
  const codes = new Set()
  const size = randomInt(3, 5)
  while (codes.size < size) codes.add(randomPet())
  debugLocation.value = { name, pets: [...codes].map((code) => ({ code, total: randomTotal() })) }
}

function apply(on) {
  clearInterval(timer)
  clearInterval(locationTimer)
  timer = locationTimer = null
  debugLocation.value = null
  if (!on) return
  showSample()
  rollLocation()
  timer = setInterval(showSample, INTERVAL_MS)
  locationTimer = setInterval(rollLocation, LOCATION_INTERVAL_MS)
}

watch(enabled, (on) => {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    // storage unavailable
  }
  apply(on)
})

apply(enabled.value)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(timer)
    clearInterval(locationTimer)
  })
}

function testToast() {
  if (enabled.value) showSample()
}

export function useDebugMode() {
  return { available: DEV_TOOLS, enabled, testToast, debugLocation }
}
