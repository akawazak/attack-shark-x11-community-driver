export interface WindowsHidDevicePath {
	path?: string;
}

export function windowsHidPhysicalKey(device: WindowsHidDevicePath): string | null {
	if (!device.path) return null;
	const segments = device.path.toLowerCase().split('#');
	if (segments.length < 4) return device.path.toLowerCase().replace(/&col[0-9a-f]{2}(?=#)/i, '');

	// Windows assigns a different collection suffix (for example 0000 vs 0002)
	// to each top-level HID collection belonging to the same physical interface.
	// Keep the stable interface and instance portions so the feature and battery
	// collections can be associated without merging separate receiver dongles.
	const interfacePath = (segments[1] ?? '').replace(/&col[0-9a-f]{2}$/i, '');
	const instanceParts = (segments[2] ?? '').split('&');
	const physicalInstance = instanceParts.slice(0, 2).join('&');
	return [segments[0], interfacePath, physicalInstance, segments[3]].join('#');
}
