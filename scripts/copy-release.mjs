// Copies the app and watcher.exe side by side into one folder:
//   node scripts/copy-release.mjs <output dir>
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BUILD_DIR = 'src-tauri/target/release'
const FILES = ['aion2-pet-tracker.exe', 'watcher.exe']

const outDir = process.argv[2]
if (!outDir) {
  console.error('Usage: node scripts/copy-release.mjs <output dir>')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
for (const file of FILES) {
  const from = join(BUILD_DIR, file)
  if (!existsSync(from)) {
    console.error(`Missing ${from} - run the Tauri build first.`)
    process.exit(1)
  }
  try {
    copyFileSync(from, join(outDir, file))
  } catch (err) {
    // EBUSY/EPERM: the copy in the output folder is still running.
    console.error(`Couldn't copy ${file} (${err.code}) - close the running app and try again.`)
    process.exit(1)
  }
}
console.log(`Copied ${FILES.join(' and ')} to ${resolve(outDir)}`)
