# Attack Shark X11 Community Driver

![Attack Shark X11 Gaming Mouse](assets/shark-x11-electron.png)

[![npm version](https://img.shields.io/npm/v/attack-shark-x11-driver.svg)](https://www.npmjs.com/package/attack-shark-x11-driver)
[![license](https://img.shields.io/npm/l/attack-shark-x11-driver.svg)](https://github.com/HarukaYamamoto0/attack-shark-x11-driver/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A cross-platform desktop app to configure your **Attack Shark X11** gaming mouse - DPI, macros, lighting, polling rate, battery status, and more. Built with Electron + Vue 3.

Community-maintained fork focused on safe Windows releases, portable builds, auto-updating installer builds, and continued Linux support. This project builds on the original reverse-engineering and GUI work credited below.

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/akawazak/attack-shark-x11-community-driver/main/install.sh | bash
```

The script auto-detects your distro:

- **Arch** -> installs from AUR
- **Ubuntu / Debian** -> downloads the latest `.deb`
- **any other Linux** -> downloads the AppImage + sets up a `.desktop` entry

Manual downloads are also available on the [Releases page](https://github.com/akawazak/attack-shark-x11-community-driver/releases).

---

## Features

**Device control** - DPI stages, button remapping, macros with timing, lighting (mode/speed/color), polling rate (125-1000 Hz), battery monitoring, device reset.

**Supported models** - Attack Shark **X11** and **R1** (auto-detected on startup).

**App features** - Dark/Light/Cappuccino themes, i18n (EN/ES), auto-save, full config persistence across restarts, type-safe settings loading, auto-detect connected device on launch.

**Platform** - Linux, macOS, Windows. 121+ tests across 11 files.

**USB Stack** - Fully migrated from `usb` v2 (node-usb, synchronous Transfer API) to `usb` v3 (node-usb-rs, async WebUSB API). Battery monitoring uses interrupt endpoint polling via `nativeTransferIn`. Upstream bug fix submitted (node-usb-rs#4).

---

## Linux Setup (udev)

The mouse needs a udev rule so the app can access it without `sudo`:

```bash
# 1. Create the rule file
sudo tee /etc/udev/rules.d/99-attack-shark-x11.rules > /dev/null <<'UDEV'
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa61", MODE="0666", GROUP="plugdev"
UDEV

# 2. Reload rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Windows Setup (one-time driver install)

On Windows the mouse is bound to the in-box HID class driver, which does not
expose libusb-style control transfers. The app needs the in-box Microsoft
**WinUSB** driver bound to the vendor/control interface only: VID `1D57`, PIDs
`FA55` / `FA60` / `FA61`, interface `MI_02`. The keyboard and mouse HID
interfaces stay on the normal Windows HID drivers.

**The app handles this for you** — if the mouse isn't found, the connection
screen will show an **Install USB Driver** button. Click it, accept the UAC
prompt, and the app will run `pnputil /add-driver` against the bundled INF.
After it succeeds, replug the mouse once and you're done — the install is
one-time per machine.

For release builds, Windows requires this INF to be shipped as a signed driver
package with a catalog (`.cat`). The INF itself uses only Microsoft's in-box
WinUSB driver; the app does not bundle a third-party kernel driver. Until the
driver package is signed through Microsoft's driver signing flow, Windows will
reject it with a missing digital signature error.

If you'd rather do it manually (e.g. you don't want to grant the app admin):

```powershell
# Run from an elevated PowerShell, pointing at the INF bundled with the app.
pnputil /add-driver "$env:LOCALAPPDATA\Programs\Attack Shark X11 Driver\resources\drivers\attack-shark-x11-winusb.inf" /install

# Then unplug and replug the mouse.
```

---

## Build From Source

Prerequisite: [Bun](https://bun.sh/)

```bash
git clone https://github.com/akawazak/attack-shark-x11-community-driver.git
cd attack-shark-x11-community-driver
bun install
bun run package     # outputs to ./dist
```

```bash
bun test            # 121+ tests
```

### Windows Builds

`bun run package` builds both Windows targets when run on Windows:

- `nsis` installer: supports Electron auto-updates through GitHub Releases metadata.
- `portable` executable: useful as a no-install app, but Electron Builder does not support auto-updating this target directly.

Auto-updates read from this repository's GitHub Releases via `build.publish` in `package.json`.

---

## Device Specs

| | |
|---|---|
| **Sensor** | PixArt PAW3311 |
| **Max DPI** | 22,000 (6 levels) |
| **Polling Rate** | 125-1000 Hz |
| **Weight** | ~63g |
| **Battery** | Up to 65 hrs / 2-3 hr charge |
| **Connectivity** | Wired + 2.4GHz wireless (Bluetooth untested) |
| **Vendor / Product** | `0x1d57` / `0xfa60` (wireless), `0xfa55` (X11 wired), `0xfa61` (R1 wired) |

---

## Supported Hardware

| Device | Mode | Status |
|---|---|---|
| Attack Shark X11 | Wired | Supported |
| Attack Shark X11 | 2.4GHz wireless | Supported |
| Attack Shark X11 | Bluetooth | Not tested |
| Attack Shark R1 | Wired | Supported |
| Attack Shark R1 | 2.4GHz wireless | Supported (via X11 compatibility) |
| Attack Shark **X11SE** | All modes | Likely compatible (same chipset, untested) |

---

## Contributing

Reverse-engineering effort. PRs welcome for protocol docs, features, or hardware testing. See `docs/` for packet analysis.

---

## License

MIT. Original work and fork contributions remain credited below.

*Not affiliated with Attack Shark. Use at your own risk.*

---

## Credits

Special thanks to the reverse-engineering community whose work made this possible:

- **[HarukaYamamoto0](https://github.com/HarukaYamamoto0)** - for the original X11 driver, detailed protocol analysis, and firmware research that forms the foundation of this project.
- **[dressedinblack5](https://github.com/dressedinblack5)** - for the Electron/Vue desktop app, extended X11 functionality, packaging work, and the maintained `node-usb-rs` fork used by this app.
- **[xb-bx](https://github.com/xb-bx)** - for the Attack Shark R1 driver, protocol documentation, and hardware testing that enabled R1 support.
- **[akawazak](https://github.com/akawazak)** - for community maintenance, Windows packaging, portable builds, auto-update setup, and release stewardship.
