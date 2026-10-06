import { reactive, watch } from 'vue'
import monsterPets from '../data/monster_pets.json'

const STORAGE_KEY = 'aion2-pet-tracker-monster-pets'

// Monsters missing from the bundled data (e.g. the Abyss), learned from the souls they drop.
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

const learned = reactive(loadState())

watch(
  learned,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // storage unavailable
    }
  },
  { deep: true },
)

export function petOfMonster(monsterId) {
  if (monsterId == null) return null
  return monsterPets[monsterId] ?? learned[monsterId] ?? null
}

export function learnMonsterPet(monsterId, petCode) {
  if (monsterId == null || !petCode || monsterPets[monsterId]) return
  learned[monsterId] = petCode
}
