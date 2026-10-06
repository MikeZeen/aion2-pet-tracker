import { useSettings } from '../composables/useSettings'
import { LANGUAGES, MESSAGES } from './messages'
import petNames from '../data/pet_names.json'

export { LANGUAGES }

export const PET_CODES = Object.keys(petNames.en)

function language() {
  const lang = useSettings().state.language
  return MESSAGES[lang] ? lang : 'en'
}

export function t(key, params = {}) {
  const text = MESSAGES[language()][key] ?? MESSAGES.en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

export function isKnownPet(code) {
  return code in petNames.en
}

export function englishPetName(code) {
  return petNames.en[code] ?? code
}

export function petName(code) {
  return petNames[language()]?.[code] ?? englishPetName(code)
}
