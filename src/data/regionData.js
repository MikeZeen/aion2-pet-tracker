import maps from './maps.json'
import overrides from './pet_overrides.json'
import petNames from './pet_names.json'
import generated from './regions.json'

// regions.json with the hand-maintained fixes of pet_overrides.json applied.

const CODE_BY_NAME = Object.fromEntries(Object.entries(petNames.en).map(([code, name]) => [name, code]))

function codeOf(name) {
  const code = CODE_BY_NAME[name]
  if (!code) throw new Error(`pet_overrides.json: unknown pet "${name}"`)
  return code
}

// An area's pet list: a region's, or a whole map's by its name (e.g. Eltnen).
function petsOf(data, area) {
  if (data.regions[area]) return data.regions[area].pets
  const map = Object.values(maps).find((m) => m.name === area)?.map
  if (map) return (data.mapPets[map] ??= [])
  throw new Error(`pet_overrides.json: unknown area "${area}"`)
}

function apply(source) {
  const data = {
    ...source,
    regions: Object.fromEntries(Object.entries(source.regions).map(([name, r]) => [name, { ...r, pets: [...r.pets] }])),
    mapPets: Object.fromEntries(Object.entries(source.mapPets).map(([map, pets]) => [map, [...pets]])),
  }
  const lists = [...Object.values(data.regions).map((r) => r.pets), ...Object.values(data.mapPets)]
  const drop = (pets, codes) => pets.splice(0, pets.length, ...pets.filter((code) => !codes.has(code)))

  const notFarmable = new Set((overrides.notFarmable ?? []).map(codeOf))
  for (const pets of lists) drop(pets, notFarmable)
  for (const [area, names] of Object.entries(overrides.remove ?? {})) {
    const codes = new Set(names.map(codeOf))
    drop(petsOf(data, area), codes)
    // Off the whole map too, unless another of its regions still has the pet.
    const map = data.regions[area]?.map
    if (!map || !data.mapPets[map]) continue
    const elsewhere = Object.values(data.regions).filter((r) => r.map === map).flatMap((r) => r.pets)
    drop(data.mapPets[map], new Set([...codes].filter((code) => !elsewhere.includes(code))))
  }
  for (const [area, names] of Object.entries(overrides.add ?? {})) {
    const pets = petsOf(data, area)
    for (const code of names.map(codeOf)) if (!pets.includes(code)) pets.push(code)
    pets.sort()
  }
  return data
}

export default apply(generated)
