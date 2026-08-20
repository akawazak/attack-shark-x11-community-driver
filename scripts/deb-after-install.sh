#!/bin/sh
set -eu

rule_target="/usr/lib/udev/rules.d/70-attack-shark-x11.rules"
legacy_rule="/etc/udev/rules.d/99-attack-shark-x11-electron.rules"

install -d -m0755 "$(dirname "$rule_target")"
rm -f -- "$legacy_rule"
printf '%s\n' \
	'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0660", TAG+="uaccess"' \
	'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0660", TAG+="uaccess"' \
	'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa61", MODE="0660", TAG+="uaccess"' \
	>"$rule_target"
chmod 0644 "$rule_target"

if command -v udevadm >/dev/null 2>&1; then
	udevadm control --reload-rules || true
	udevadm trigger --subsystem-match=usb --attr-match=idVendor=1d57 || true
fi
