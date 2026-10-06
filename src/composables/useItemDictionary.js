import { reactive, watch } from 'vue'

const STORAGE_KEY = 'aion2-pet-tracker-item-ids'

// Pets newer than the bundled data, mapped by the user or learned from their monster.
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

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

function normalizeId(id) {
  return String(id).trim().toLowerCase().replace(/\s+/g, '')
}

export function useItemDictionary() {
  function get(id) {
    return state[normalizeId(id)] ?? null
  }

  function setItem(id, { name, kind = 'soul', petCode = null }) {
    state[normalizeId(id)] = { name, kind, petCode }
  }

  function ignoreItem(id) {
    state[normalizeId(id)] = { name: null, kind: 'ignored', petCode: null }
  }

  return { state, get, setItem, ignoreItem }
}
