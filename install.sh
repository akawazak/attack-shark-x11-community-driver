#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="dressedinblack5/attack-shark-x11-electron"
APP_NAME="attack-shark-x11-electron"
UDEV_RULES="/etc/udev/rules.d/99-${APP_NAME}.rules"

# --- helpers -----------------------------------------------------------

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
green() { color 32 "$*"; }
yellow() { color 33 "$*"; }
red() { color 31 "$*"; }

latest_url() {
	curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" |
		grep -o "\"browser_download_url\": *\"[^\"]*${1}[^\"]*\"" |
		head -1 | cut -d'"' -f4
}

# --- udev rules --------------------------------------------------------

write_udev() {
	if [ -f "$UDEV_RULES" ]; then
		green "Udev rules already present, skipping."
		return
	fi
	yellow "Setting up udev rules (requires sudo) …"
	sudo tee "$UDEV_RULES" >/dev/null <<'UDEV'
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa61", MODE="0666", GROUP="plugdev"
UDEV
	sudo udevadm control --reload-rules
	sudo udevadm trigger
}

# --- distro detection --------------------------------------------------

distro() {
	if [ -f /etc/arch-release ]; then echo arch
	elif grep -qi "ubuntu\|debian" /etc/os-release 2>/dev/null; then echo debian
	else echo unknown
	fi
}

# --- arch (AUR) --------------------------------------------------------

install_arch() {
	green "Detected Arch Linux → installing from AUR."
	local helper
	for h in yay paru; do
		command -v "$h" >/dev/null && { helper="$h"; break; }
	done
	if [ -z "${helper:-}" ]; then
		red "No AUR helper found. Install yay first:"
		echo "  sudo pacman -S --needed git base-devel"
		echo "  git clone https://aur.archlinux.org/yay.git && cd yay && makepkg -si"
		exit 1
	fi
	"$helper" -S --noconfirm "$APP_NAME"
}

# --- debian / ubuntu (.deb) --------------------------------------------

install_deb() {
	green "Detected Debian/Ubuntu → installing from .deb."
	local url
	url=$(latest_url '\.deb$')
	[ -n "$url" ] || { red "Could not resolve .deb download URL."; exit 1; }

	local tmp="/tmp/${APP_NAME}.deb"
	yellow "Downloading $url …"
	curl -fL --progress-bar -o "$tmp" "$url"

	yellow "Installing (requires sudo) …"
	sudo apt install -y "$tmp" 2>/dev/null || {
		sudo dpkg -i "$tmp" && sudo apt install -f -y
	}
	rm -f "$tmp"
}

# --- appimage (fallback) -----------------------------------------------

install_appimage() {
	green "Unrecognised distro → installing AppImage."
	local url
	url=$(latest_url '\.AppImage$')
	[ -n "$url" ] || { red "Could not resolve AppImage download URL."; exit 1; }

	local bin="${HOME}/.local/bin"
	local desktop_dir="${HOME}/.local/share/applications"
	local icon_dir="${HOME}/.local/share/icons/hicolor/scalable/apps"
	mkdir -p "$bin" "$desktop_dir" "$icon_dir"

	yellow "Downloading $url …"
	curl -fL --progress-bar -o "${bin}/${APP_NAME}" "$url"
	chmod +x "${bin}/${APP_NAME}"

	yellow "Fetching icon …"
	curl -fsSL --progress-bar -o "${icon_dir}/attack-shark-x11.svg" \
		"https://raw.githubusercontent.com/${GITHUB_REPO}/main/assets/cs-mouse.svg"

	cat >"${desktop_dir}/${APP_NAME}.desktop" <<EOF
[Desktop Entry]
Name=Attack Shark X11
Comment=Configuration tool for the Attack Shark X11 gaming mouse
Exec=${bin}/${APP_NAME}
Icon=attack-shark-x11
Terminal=false
Type=Application
Categories=HardwareSettings;Settings;
Keywords=mouse;gaming;driver;
EOF

	if ! echo "$PATH" | tr ':' '\n' | grep -qxF "$bin"; then
		yellow "Tip: add ~/.local/bin to your PATH:"
		echo "  export PATH=\"\$HOME/.local/bin:\$PATH\"  # >> ~/.bashrc"
	fi

	green "Installed to ${bin}/${APP_NAME}"
}

# --- main --------------------------------------------------------------

main() {
	green "=== Attack Shark X11 Driver Installer ==="
	echo   "   ${GITHUB_REPO}/releases"
	echo

	write_udev

	case "$(distro)" in
		arch)   install_arch ;;
		debian) install_deb ;;
		*)      install_appimage ;;
	esac

	echo
	green "Done. Launch 'Attack Shark X11' from your app menu or run: ${APP_NAME}"
}

main
