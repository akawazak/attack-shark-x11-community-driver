#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="akawazak/attack-shark-x11-community-driver"
APP_NAME="attack-shark-x11-electron"
RULE_NAME="70-attack-shark-x11.rules"
RULE_TARGET="/usr/lib/udev/rules.d/${RULE_NAME}"
OLD_RULE="/etc/udev/rules.d/99-attack-shark-x11-electron.rules"
GROUP_RULE="/etc/udev/rules.d/71-attack-shark-x11-group.rules"
ACCESS_GROUP="attackshark"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TMP_DIR"' EXIT

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
green() { color 32 "$*"; }
yellow() { color 33 "$*"; }
red() { color 31 "$*"; }

curl_safe() {
	curl --proto '=https' --tlsv1.2 --fail --location --show-error "$@"
}

load_release_metadata() {
	yellow "Reading the latest release metadata..."
	curl_safe --silent --output "$TMP_DIR/release.json" \
		"https://api.github.com/repos/${GITHUB_REPO}/releases/latest"

	local checksums_url
	checksums_url="$(asset_url '/SHA256SUMS$')"
	if [ -z "$checksums_url" ]; then
		red "The release does not contain SHA256SUMS; refusing an unverified installation."
		exit 1
	fi
	curl_safe --silent --output "$TMP_DIR/SHA256SUMS" "$checksums_url"
}

asset_url() {
	local suffix="$1"
	grep -o '"browser_download_url":[[:space:]]*"[^"]*"' "$TMP_DIR/release.json" |
		cut -d'"' -f4 |
		grep -E "$suffix" |
		head -n1 || true
}

download_verified() {
	local suffix="$1"
	local url filename expected destination
	url="$(asset_url "$suffix")"
	if [ -z "$url" ]; then
		red "The release does not contain an asset matching ${suffix}."
		exit 1
	fi
	filename="${url##*/}"
	destination="$TMP_DIR/$filename"
	yellow "Downloading ${filename}..." >&2
	curl_safe --progress-bar --output "$destination" "$url"
	expected="$(awk -v name="$filename" '$2 == name || $2 == "*" name { print $1; exit }' "$TMP_DIR/SHA256SUMS")"
	if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
		red "No valid checksum was published for ${filename}."
		exit 1
	fi
	printf '%s  %s\n' "$expected" "$destination" | sha256sum --check --status
	green "Verified ${filename}." >&2
	printf '%s\n' "$destination"
}

install_rule() {
	local rule_file
	rule_file="$(download_verified "/${RULE_NAME}$")"
	yellow "Installing local-device permissions (requires sudo)..."
	sudo rm -f -- "$OLD_RULE"
	sudo install -Dm0644 "$rule_file" "$RULE_TARGET"
	sudo udevadm control --reload-rules
	sudo udevadm trigger --subsystem-match=usb --attr-match=idVendor=1d57 || true
}

install_group_access() {
	local target_user="${SUDO_USER:-${USER:-}}"
	if [ -z "$target_user" ] || [ "$target_user" = root ] || ! id "$target_user" >/dev/null 2>&1; then
		red "Run this command from the desktop account that should access the mouse, not from a root login."
		exit 1
	fi

	yellow "Configuring the optional ${ACCESS_GROUP} device-access group (requires sudo)..."
	sudo groupadd --force "$ACCESS_GROUP"
	sudo usermod --append --groups "$ACCESS_GROUP" "$target_user"
	sudo rm -f -- "$OLD_RULE"
	printf '%s\n' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0660", GROUP="attackshark"' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0660", GROUP="attackshark"' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa61", MODE="0660", GROUP="attackshark"' |
		sudo tee "$GROUP_RULE" >/dev/null
	sudo chmod 0644 "$GROUP_RULE"
	sudo udevadm control --reload-rules
	sudo udevadm trigger --subsystem-match=usb --attr-match=idVendor=1d57 || true

	green "Added ${target_user} to ${ACCESS_GROUP} with restricted device access."
	yellow "Log out completely and sign back in, then reconnect the mouse."
}

distro() {
	if [ -f /etc/arch-release ]; then
		echo arch
	elif grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
		echo debian
	else
		echo unknown
	fi
}

install_arch() {
	green "Detected Arch Linux; installing the reviewed AUR package."
	local helper=""
	for candidate in yay paru; do
		if command -v "$candidate" >/dev/null 2>&1; then
			helper="$candidate"
			break
		fi
	done
	if [ -z "$helper" ]; then
		red "No AUR helper was found. Install yay or paru, then rerun this installer."
		exit 1
	fi
	"$helper" -S "$APP_NAME"
}

install_deb() {
	green "Detected Debian/Ubuntu."
	local package_file
	package_file="$(download_verified '\.deb$')"
	install_rule
	yellow "Installing the verified package (requires sudo)..."
	sudo apt install -y "$package_file"
}

install_appimage() {
	green "Using the portable AppImage installation."
	local appimage icon
	appimage="$(download_verified '\.AppImage$')"
	icon="$(download_verified '/cs-mouse\.svg$')"
	install_rule

	local bin_dir="${HOME}/.local/bin"
	local desktop_dir="${HOME}/.local/share/applications"
	local icon_dir="${HOME}/.local/share/icons/hicolor/scalable/apps"
	mkdir -p "$bin_dir" "$desktop_dir" "$icon_dir"
	install -m0755 "$appimage" "${bin_dir}/${APP_NAME}"
	install -m0644 "$icon" "${icon_dir}/attack-shark-x11.svg"

	tee "${desktop_dir}/${APP_NAME}.desktop" >/dev/null <<EOF
[Desktop Entry]
Name=Attack Shark X11 Driver
Comment=Configure an Attack Shark X11-compatible gaming mouse
Exec=${bin_dir}/${APP_NAME}
Icon=attack-shark-x11
Terminal=false
Type=Application
Categories=HardwareSettings;Settings;
Keywords=mouse;gaming;driver;
EOF

	green "Installed to ${bin_dir}/${APP_NAME}."
}

main() {
	if [ "$#" -gt 1 ]; then
		red "Usage: bash install.sh [--group-access]"
		exit 2
	fi
	case "${1:-}" in
	--group-access)
		install_group_access
		return
		;;
	"") ;;
	*)
		red "Unknown option: $1"
		red "Usage: bash install.sh [--group-access]"
		exit 2
		;;
	esac

	load_release_metadata
	green "Attack Shark X11 Driver installer"
	echo "Release source: https://github.com/${GITHUB_REPO}/releases"
	echo
	case "$(distro)" in
	arch) install_arch ;;
	debian) install_deb ;;
	*) install_appimage ;;
	esac
	echo
	green "Done. Reconnect the mouse once if Linux permissions were just installed."
	echo "If your desktop does not support uaccess ACLs, run: bash install.sh --group-access"
}

main "$@"
