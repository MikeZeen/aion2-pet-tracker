import { reactive } from 'vue'
import { petOfMonster } from './useMonsterPets'
import mapTransforms from '../data/map_transforms.json'
import maps from '../data/maps.json'
import regionData from '../data/regions.json'

export const REGION_NAMES = Object.keys(regionData.regions)

// aion2hub maps split into regions; the others are known only as a whole.
const MAPS_WITH_REGIONS = new Set(Object.values(regionData.regions).map((region) => region.map))

const live = reactive({ mapId: null, monsters: [], recent: [], region: null, positionAt: 0 })

// Positions can arrive before the first map id; kept to resolve the area once it does.
let lastPosition = null

// A real position decides the area for this long before the monster vote takes over again.
const POSITION_MS = 20_000

// A monster's vote halves every this many seconds, so recent ones decide.
const VOTE_HALF_LIFE = 8

function pointInRing(x, y, ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[j]
    if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) hit = !hit
  }
  return hit
}

function regionAt(mapId, x, y) {
  const t = mapTransforms[mapId]
  if (!t) return null
  const px = t.a[0][0] * x + t.a[0][1] * y + t.b[0]
  const py = t.a[1][0] * x + t.a[1][1] * y + t.b[1]
  for (const [name, region] of Object.entries(regionData.regions)) {
    if (region.map === t.map && region.borders.some((ring) => pointInRing(px, py, ring))) return name
  }
  return null
}

// recent: [[monster id, seconds ago], ...]. Only the map's own regions count.
// The current area wins ties to avoid flicker at borders.
function voteRegion(recent, current, map) {
  const votes = new Map()
  for (const [id, age] of recent) {
    const weight = 0.5 ** (age / VOTE_HALF_LIFE)
    for (const region of regionData.monsterRegions[id] ?? []) {
      if (regionData.regions[region].map === map) votes.set(region, (votes.get(region) ?? 0) + weight)
    }
  }
  let best = current && votes.has(current) ? current : null
  for (const [region, count] of votes) {
    if (!best || count > votes.get(best)) best = region
  }
  return best ?? current
}

// The aion2hub map of a game map known only as a whole (e.g. Eltnen), else null.
function wholeMap(mapId) {
  const map = maps[mapId]?.map
  return map && !MAPS_WITH_REGIONS.has(map) ? map : null
}

export function useLocation() {
  function setLiveZone(mapId) {
    const first = live.mapId == null
    live.mapId = mapId
    live.monsters = []
    live.region = null
    if (first && lastPosition) setLivePosition(lastPosition.x, lastPosition.y, lastPosition.source)
  }

  function setLiveNearby(monsterIds, recent = []) {
    live.monsters = monsterIds
    live.recent = recent.map(([id]) => id)
    const map = maps[live.mapId]?.map
    if (!MAPS_WITH_REGIONS.has(map)) return
    if (Date.now() - live.positionAt > POSITION_MS) live.region = voteRegion(recent, live.region, map)
  }

  // "movement" positions are rough estimates and only fill in while the area is unknown.
  function setLivePosition(x, y, source) {
    lastPosition = { x, y, source }
    const rough = source === 'movement'
    if (rough && live.region) return
    const region = regionAt(live.mapId, x, y)
    if (region) {
      live.region = region
      if (!rough) live.positionAt = Date.now()
    }
  }

  // The area whose pets are listed: the region, or a map known only as a whole.
  function areaName() {
    if (live.region) return live.region
    return wholeMap(live.mapId) ? maps[live.mapId].name : null
  }

  function locationName() {
    if (live.mapId == null) return null
    return areaName() ?? 'nearby'
  }

  // The area's pets plus those of nearby monsters that aren't placed in any area.
  // While the area is unknown (or the map has no data, e.g. the Abyss), every monster seen lately counts.
  function currentPets() {
    if (live.mapId == null) return []
    const map = wholeMap(live.mapId)
    if (!live.region && !map) return [...new Set(live.monsters.map(petOfMonster).filter(Boolean))]
    const area = map ? regionData.mapPets[map] : (regionData.regions[live.region]?.pets ?? [])
    const unplaced = live.recent.filter((id) => map || !regionData.monsterRegions[id]).map(petOfMonster)
    return [...new Set([...area, ...unplaced.filter(Boolean)])]
  }

  return { live, setLiveZone, setLiveNearby, setLivePosition, areaName, locationName, currentPets }
}
