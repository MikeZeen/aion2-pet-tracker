import { reactive } from 'vue'
import { useItemDictionary } from './useItemDictionary'
import { useLocation } from './useLocation'
import { learnMonsterPet, petOfMonster } from './useMonsterPets'
import { useSettings } from './useSettings'
import { useSoulCounts } from './useSoulCounts'
import { useToasts } from './useToasts'
import { englishPetName, PET_CODES, petName, t } from '../i18n'
import petIds from '../data/pet_ids.json'

// Accepts the English or the current language's name.
function petCodeByName(name) {
  const lower = name.toLowerCase()
  return PET_CODES.find((code) => englishPetName(code).toLowerCase() === lower || petName(code).toLowerCase() === lower)
}

const state = reactive({
  status: 'idle', // idle | listening | ready | error
  error: null,
  pending: [], // [{ id, count, nameInput }] souls of unknown pets, waiting for a pick
})

let unsubscribe = null

const { pushToast, pushSoulToast } = useToasts()

function grantSouls(petCode, amount, monsterId = null) {
  learnMonsterPet(monsterId, petCode)
  const { add, petInfo } = useSoulCounts()
  const gain = add(petCode, amount)
  const label = amount > 1 ? `${gain.label} ×${amount}` : gain.label
  pushSoulToast({ ...petInfo(petCode), ...gain, label })
}

function handleLoot({ itemId, monsterId, maxed, count = 1 }) {
  const { get: getItem, setItem } = useItemDictionary()

  // Souls of a maxed pet carry no pet id; the source monster names it.
  if (maxed) {
    const petCode = petOfMonster(monsterId)
    if (petCode) grantSouls(petCode, count)
    return
  }
  if (petIds[itemId]) {
    grantSouls(petIds[itemId], count, monsterId)
    return
  }

  // A pet newer than the bundled data: learn it from the source monster.
  const item = getItem(itemId)
  const fromMonster = !item ? petOfMonster(monsterId) : null
  if (fromMonster) {
    setItem(itemId, { name: englishPetName(fromMonster), kind: 'soul', petCode: fromMonster })
    grantSouls(fromMonster, count)
    return
  }
  if (item?.kind === 'soul' && item.petCode) {
    grantSouls(item.petCode, count, monsterId)
    return
  }
  if (item) return

  const existing = state.pending.find((p) => p.id === itemId)
  if (existing) {
    existing.count += count
  } else {
    state.pending.push({ id: itemId, count, nameInput: '' })
    pushToast(t('toast.unknownSoul', { id: itemId }), 'info')
  }
}

function handleEvent(payload) {
  switch (payload.type) {
    case 'listening':
      state.status = 'listening'
      break
    case 'ready':
      state.status = 'ready'
      pushToast(t('toast.gameFound'), 'success')
      break
    case 'character': {
      const { state: settings, apply } = useSettings()
      if (settings.character !== payload.name) {
        apply({ character: payload.name })
        pushToast(t('toast.tracking', { name: payload.name }), 'success')
      }
      break
    }
    case 'error':
      state.status = 'error'
      state.error = payload.message
      pushToast(t('toast.watcherError', { error: payload.message }), 'error')
      break
    case 'zone':
      useLocation().setLiveZone(payload.mapId)
      break
    case 'nearby':
      useLocation().setLiveNearby(payload.monsters, payload.recent)
      break
    case 'position':
      useLocation().setLivePosition(payload.x, payload.y, payload.source)
      break
    case 'collection': {
      const { setProgress } = useSoulCounts()
      let synced = 0
      for (const [petId, level, souls] of payload.pets) {
        const petCode = petIds[petId]
        if (!petCode) continue
        setProgress(petCode, level, souls)
        synced += 1
      }
      pushToast(t('toast.synced', { n: synced }), 'success')
      break
    }
    case 'loot':
      handleLoot(payload)
      break
    default:
      break
  }
}

export function useLiveWatcher() {
  const { setItem, ignoreItem } = useItemDictionary()

  async function start(character, iface) {
    if (!window.aion2Watcher) {
      pushToast(t('toast.noWatcher'), 'error')
      return
    }
    state.status = 'listening'
    state.error = null
    if (!unsubscribe) unsubscribe = window.aion2Watcher.onEvent(handleEvent)
    await window.aion2Watcher.start(character, iface)
  }

  function resolvePending(item) {
    const name = item.nameInput.trim()
    const petCode = petCodeByName(name)
    if (!petCode) return false
    setItem(item.id, { name: englishPetName(petCode), kind: 'soul', petCode })
    state.pending = state.pending.filter((p) => p.id !== item.id)
    grantSouls(petCode, item.count)
    return true
  }

  function ignorePending(item) {
    ignoreItem(item.id)
    state.pending = state.pending.filter((p) => p.id !== item.id)
  }

  return { state, start, resolvePending, ignorePending }
}
