# Maintainer: akawazak <https://github.com/akawazak>
pkgname=attack-shark-x11-electron
_srcname=attack-shark-x11-community-driver
pkgver=1.4.5
pkgrel=1
pkgdesc="Desktop configuration tool for Attack Shark X11-compatible gaming mice"
arch=('x86_64')
url="https://github.com/akawazak/attack-shark-x11-community-driver"
license=('MIT')
depends=(
	'alsa-lib' 'at-spi2-core' 'cairo' 'dbus' 'expat' 'glib2' 'gtk3' 'libdrm' 'libusb'
	'libx11' 'libxcb' 'libxcomposite' 'libxdamage' 'libxext' 'libxfixes' 'libxkbcommon'
	'libxrandr' 'mesa' 'nspr' 'nss' 'pango'
)
makedepends=('bun>=1.3.14')
options=('!strip')
install=attack-shark-x11-electron.install
source=("$url/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('47fc48637df7b276c2552f85733dd2197abdad6eba522c9317386fd91312283c')

prepare() {
	cd "$srcdir/$_srcname-$pkgver"
	bun install --frozen-lockfile
}

build() {
	cd "$srcdir/$_srcname-$pkgver"
	bun run build
	bunx electron-builder --linux dir --x64 --publish never
}

package() {
	cd "$srcdir/$_srcname-$pkgver"

	install -d "$pkgdir/opt/$pkgname"
	cp -a dist/linux-unpacked/. "$pkgdir/opt/$pkgname/"

	local executable=attack-shark-x11-electron
	if [[ ! -x "dist/linux-unpacked/$executable" ]]; then
		executable=attack-shark-x11-driver
	fi
	install -d "$pkgdir/usr/bin"
	ln -s "/opt/$pkgname/$executable" "$pkgdir/usr/bin/attack-shark-x11-electron"

	install -Dm0644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
	install -Dm0644 assets/attack-shark-x11-electron.desktop \
		"$pkgdir/usr/share/applications/attack-shark-x11-electron.desktop"
	install -Dm0644 assets/cs-mouse.svg \
		"$pkgdir/usr/share/icons/hicolor/scalable/apps/attack-shark-x11.svg"
	install -d "$pkgdir/usr/lib/udev/rules.d"
	printf '%s\n' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa60", MODE="0660", TAG+="uaccess"' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa55", MODE="0660", TAG+="uaccess"' \
		'SUBSYSTEM=="usb", ATTR{idVendor}=="1d57", ATTR{idProduct}=="fa61", MODE="0660", TAG+="uaccess"' \
		>"$pkgdir/usr/lib/udev/rules.d/70-attack-shark-x11.rules"
	chmod 0644 "$pkgdir/usr/lib/udev/rules.d/70-attack-shark-x11.rules"
}
