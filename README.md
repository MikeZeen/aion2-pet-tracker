# Aion 2 Pet Tracker

A small always-on-top overlay for Aion 2 that tracks your pet soul collection while you play.

- **Automatic progress:** reads your pet levels and soul counts from the game at login, and counts every soul you pick up after that.
- **Soul toasts:** each soul you pick up shows a short notification with the pet's progress toward its next level.
- **Pets in your area:** lists the pets you can farm where you are right now, with your progress on each.
- **Click-through:** the overlay never blocks the game. Press `Ctrl+Shift+M` to open the settings.
- **Languages:** English, Deutsch, Français, Español, Português, Русский, 한국어, 日本語 and 中文 (繁體), including translated pet names. The system language is used by default.

The tracker only reads network traffic passively. It doesn't modify the game, inject anything or send any data. Its only connection is the update check against GitHub.

## Screenshots

**Pets in your area:** the overlay lists the pets of the area you're in, with your level and soul progress on each.

![Pets in Immortal Isle panel](docs/screenshots/pets-in-region.png)

**Soul loot:** picking up a soul shows a toast with the pet's progress toward its next level.

![Soul obtained toast](docs/screenshots/soul-loot.png)

**Settings:** press `Ctrl+Shift+M` to change the language, size, color and opacity, or to diagnose the network.

![Settings panel](docs/screenshots/settings.png)

## Work in progress

This tracker is still in development, so bugs can happen: a soul might not be counted, or the pet list might be wrong for your area. I'm constantly updating it, and the app tells you when a new version is available.

## Requirements

- Windows 10 or 11
- [Npcap](https://npcap.com), installed with the default options
- Administrator rights, which packet capture needs. The app asks for them on launch.

## Usage

1. Unzip the release anywhere and run `aion2-pet-tracker.exe`. Keep `watcher.exe` in the same folder.
2. Start Aion 2 and log in. Your pet progress syncs as soon as you enter the world.
3. Press `Ctrl+Shift+M` to switch between the overlay and the settings (language, size, color, opacity, network diagnostics).

If nothing is detected, use **Settings → Diagnose network**. It listens on every network adapter for 20 seconds and reports where the game traffic is. This helps with VPNs and ping-reduction tools.

### Pets in your area: which maps are covered

How precise the pet list is depends on the map:

| Map | What the list shows |
|---|---|
| Verteron, Altgard | The pets of the exact area you're in, e.g. *Pets in Immortal Isle*. |
| Eltnen, Morheim | All pets of the whole map, e.g. *Pets in Eltnen*. Areas within these maps aren't known yet. |
| Abyss and everywhere else | *Pets nearby*: only the pets of monsters around you that the tracker knows. |

The Abyss works differently because the bundled data has no Abyss monsters. The tracker learns them while you play: when you pick up a soul, it remembers which monster dropped it, and from then on that monster's pet appears in the list whenever the monster is near you. The list starts empty in the Abyss ("No pets known for the monsters here yet") and fills in as you collect souls there. These learned links are saved on your computer and kept between sessions.

## Development

You need Node.js 20+, Rust (stable) and Python 3.11+.

```sh
npm install
pip install -r scripts/requirements.txt
npm run tauri:dev     # dev build; runs scripts/watcher.py through Python
```

Live capture needs an elevated terminal. Without the game running, you can replay a capture:

```sh
python scripts/watcher.py --replay capture.pcap
```

### Building

```sh
npm run dist          # release build -> release/win-unpacked/
npm run dist:dev      # build with debug mode and DevTools -> release-dev/win-unpacked/
```

Both commands bundle the watcher into a standalone `watcher.exe` with PyInstaller, build the app and copy the two exes into one folder. The app is portable: zip that folder to distribute it.

### Project layout

| Path | Contents |
| --- | --- |
| `src/` | Vue frontend: overlay, toasts, settings |
| `src/data/` | Pet names (all languages), pet and monster IDs, areas |
| `src/i18n/` | Interface translations |
| `public/portraits/` | Pet portraits |
| `src-tauri/` | Tauri shell: overlay window, shortcuts, watcher process |
| `scripts/protocol.py` | Decoder for the game's network protocol |
| `scripts/watcher.py` | Packet capture; sends events to the app as JSON lines |
| `scripts/diagnose.py` | Network diagnostics |

## AI Usage

AI was used during development, mainly for the network analysis: working out the game's message framing and the packets for soul pickups, the pet collection, positions and areas from recorded captures. The decoded protocol is documented in `scripts/protocol.py`.

## Disclaimer

This is an unofficial fan project, not affiliated with or endorsed by NCSOFT. Aion 2 and all related names and artwork belong to their respective owners.
