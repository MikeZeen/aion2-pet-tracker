// Debug features: on in `npm run dev` and the dev build (`npm run dist:dev`), off in releases.
export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true'
