#!/bin/sh
set -eu

rm -f /usr/lib/udev/rules.d/70-attack-shark-x11.rules
rm -f /etc/udev/rules.d/99-attack-shark-x11-electron.rules
if command -v udevadm >/dev/null 2>&1; then
	udevadm control --reload-rules || true
fi
