import { describe, expect, it, vi, beforeEach } from 'bun:test';

const mockInEndpoint = {
	address: 0x83,
	descriptor: { wMaxPacketSize: 64 },
	pollActive: false,
	listeners: {} as Record<string, Array<(...args: unknown[]) => void>>,
	on(event: string, cb: (...args: unknown[]) => void) {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(cb);
	},
	emit(event: string, ...args: unknown[]) {
		const cbs = this.listeners[event] || [];
		for (const cb of cbs) cb(...args);
	},
	startPoll: vi.fn(),
	stopPoll: vi.fn(),
};

const mockInterface = {
	isKernelDriverActive: vi.fn(() => false),
	detachKernelDriver: vi.fn(),
	claim: vi.fn(),
	endpoints: [mockInEndpoint],
	release: vi.fn((_wait: boolean, cb: (err?: Error) => void) => cb()),
};

function createMockDevice(productId: number) {
	return {
		deviceDescriptor: {
			idVendor: 0x1d57,
			idProduct: productId,
			bcdDevice: 0x0200,
			bNumConfigurations: 1,
		},
		open: vi.fn(),
		close: vi.fn(),
		interface: vi.fn(() => mockInterface),
		controlTransfer: vi.fn(
			(
				_bmReqType: number,
				_bReq: number,
				_wVal: number,
				_wIndex: number,
				data: Buffer | number,
				cb: (err: Error | null, res?: number | Buffer) => void,
			) => {
				if (typeof data === 'number') {
					cb(null, Buffer.alloc(data));
				} else {
					cb(null, data.length);
				}
			},
		),
	};
}

const mockDevices = [createMockDevice(0xfa60), createMockDevice(0xfa55)];

vi.mock('usb', () => ({
	getDeviceList: vi.fn(() => mockDevices),
}));

const { AttackSharkX11, ConnectionMode, DriverError, DeviceError } = await import('../src/main/driver/index.js');

function createDriver(mode: ConnectionMode = ConnectionMode.Adapter): InstanceType<typeof AttackSharkX11> {
	return new AttackSharkX11({ connectionMode: mode, delayMs: 0 });
}

describe('AttackSharkX11', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockInterface.isKernelDriverActive = vi.fn(() => false);
	});

	describe('constructor', () => {
		it('should create an Adapter-mode instance when device is found', () => {
			const driver = new AttackSharkX11({ connectionMode: ConnectionMode.Adapter });
			expect(driver.connectionMode).toBe(ConnectionMode.Adapter);
			expect(driver.productId).toBe(0xfa60);
			expect(driver.delayMs).toBe(250);
		});

		it('should create a Wired-mode instance when device is found', () => {
			const driver = new AttackSharkX11({ connectionMode: ConnectionMode.Wired });
			expect(driver.connectionMode).toBe(ConnectionMode.Wired);
			expect(driver.productId).toBe(0xfa55);
		});

		it('should throw DriverError if connectionMode is not specified', () => {
			expect(() => new AttackSharkX11({} as { connectionMode: ConnectionMode })).toThrow(DriverError);
		});

		it('should throw DeviceError if no matching device is found', async () => {
			const usb = await import('usb');
			usb.getDeviceList.mockReturnValueOnce([]);
			expect(() => new AttackSharkX11({ connectionMode: ConnectionMode.Adapter })).toThrow(DeviceError);
		});

		it('should accept custom delayMs', () => {
			const driver = new AttackSharkX11({ connectionMode: ConnectionMode.Adapter, delayMs: 500 });
			expect(driver.delayMs).toBe(500);
		});
	});

	describe('open()', () => {
		it('should open the device and claim the interface', () => {
			const driver = createDriver();
			driver.open();

			expect(driver.device.open).toHaveBeenCalledTimes(1);
			expect(driver.device.interface).toHaveBeenCalledWith(2);
			expect(driver.deviceInterface.claim).toHaveBeenCalledTimes(1);
		});

		it('should detach kernel driver on Linux when active', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'linux' });

			const driver = createDriver();
			mockInterface.isKernelDriverActive = vi.fn(() => true);
			driver.open();

			expect(mockInterface.detachKernelDriver).toHaveBeenCalledTimes(1);

			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should not detach kernel driver on non-Linux even if active', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'darwin' });

			const driver = createDriver();
			mockInterface.isKernelDriverActive = vi.fn(() => true);
			driver.open();

			expect(mockInterface.detachKernelDriver).not.toHaveBeenCalled();

			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should not detach kernel driver if not active on Linux', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'linux' });

			const driver = createDriver();
			driver.open();

			expect(mockInterface.detachKernelDriver).not.toHaveBeenCalled();

			Object.defineProperty(process, 'platform', { value: originalPlatform });
		});

		it('should start interrupt polling on open', () => {
			const driver = createDriver();
			driver.open();

			expect(mockInEndpoint.startPoll).toHaveBeenCalledWith(3, 64);
		});
	});

	describe('close()', () => {
		it('should close the device and release the interface', async () => {
			const driver = createDriver();
			driver.open();
			await driver.close();

			expect(driver.device.close).toHaveBeenCalledTimes(1);
		});

		it('should do nothing if not open', async () => {
			const driver = createDriver();
			const spy = vi.spyOn(driver.device, 'close');
			await driver.close();
			expect(spy).not.toHaveBeenCalled();
		});

		it('should stop polling if active', async () => {
			const driver = createDriver();
			driver.open();

			mockInEndpoint.pollActive = true;
			await driver.close();
			expect(mockInEndpoint.stopPoll).toHaveBeenCalled();
		});

		it('should not throw when device close has pending request error', async () => {
			const driver = createDriver();
			driver.open();

			driver.device.close.mockImplementationOnce(() => {
				throw new Error('LIBUSB_ERROR_NOT_FOUND pending request');
			});

			await expect(driver.close()).resolves.toBeUndefined();
		});
	});

	describe('getBatteryLevel()', () => {
		it('should return -1 in wired mode', async () => {
			const driver = createDriver(ConnectionMode.Wired);
			driver.open();
			const level = await driver.getBatteryLevel();
			expect(level).toBe(-1);
		});

		it('should resolve when batteryChange event fires', async () => {
			const driver = createDriver();
			driver.open();

			const result = driver.getBatteryLevel(5000);
			driver.emit('batteryChange', 75);

			await expect(result).resolves.toBe(75);
		});

		it('should use cached battery value if available', async () => {
			const driver = createDriver();
			driver.open();

			mockInEndpoint.emit('data', Buffer.from([0x03, 0x55, 0x40, 0x01, 50]));
			await expect(driver.getBatteryLevel()).resolves.toBe(50);
		});

		it('should emit batteryChange from interrupt endpoint data', () => {
			const driver = createDriver();
			driver.open();

			const listener = vi.fn();
			driver.on('batteryChange', listener);

			mockInEndpoint.emit('data', Buffer.from([0x03, 0x55, 0x40, 0x01, 73]));

			expect(listener).toHaveBeenCalledWith(73);
		});

		it('should timeout if no battery event received', async () => {
			const driver = createDriver();
			driver.open();

			await expect(driver.getBatteryLevel(10)).rejects.toThrow('Timeout waiting for battery report');
		});
	});

	describe('checkIsOpen()', () => {
		it('should throw DriverError if device not opened', () => {
			const driver = createDriver();
			expect(() => driver.checkIsOpen()).toThrow(DriverError);
		});

		it('should not throw if device is open', () => {
			const driver = createDriver();
			driver.open();
			expect(() => driver.checkIsOpen()).not.toThrow();
		});
	});

	describe('getDeviceInfo()', () => {
		it('should return device info with correct values for adapter mode', () => {
			const driver = createDriver();
			driver.open();
			const info = driver.getDeviceInfo();

			expect(info.manufacturer).toBe('Beken');
			expect(info.product).toBe('Attack Shark X11');
			expect(info.vendorId).toBe('0x1d57');
			expect(info.productId).toBe('0xfa60');
			expect(info.connectionMode).toBe('Wireless (2.4GHz)');
			expect(info.interfaces).toBe(1);
		});

		it('should return Wired connection mode for wired device', () => {
			const driver = createDriver(ConnectionMode.Wired);
			driver.open();
			const info = driver.getDeviceInfo();

			expect(info.productId).toBe('0xfa55');
			expect(info.connectionMode).toBe('Wired (USB)');
		});
	});

	describe('controlTransfer()', () => {
		it('should throw if device not open', async () => {
			const driver = createDriver();
			await expect(
				driver.controlTransfer({
					bmRequestType: 0x21,
					bRequest: 0x09,
					wValue: 0x0304,
					wIndex: 2,
					data: Buffer.from([0x04]),
				}),
			).rejects.toThrow(DriverError);
		});

		it('should send control transfer with output data', async () => {
			const driver = createDriver();
			driver.open();

			const data = Buffer.from([0x04, 0x01]);
			const result = await driver.controlTransfer({
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0304,
				wIndex: 2,
				data,
			});

			expect(result).toBe(2);
			expect(driver.device.controlTransfer).toHaveBeenCalledWith(
				0x21,
				0x09,
				0x0304,
				2,
				data,
				expect.any(Function),
			);
		});

		it('should use Feature report type for wired mode OUT transfers', async () => {
			const driver = createDriver(ConnectionMode.Wired);
			driver.open();

			const data = Buffer.from([0x04, 0x01]);
			await driver.controlTransfer({
				bmRequestType: 0x21,
				bRequest: 0x09,
				wValue: 0x0304,
				wIndex: 2,
				data,
			});

			expect(driver.device.controlTransfer).toHaveBeenCalledWith(
				0x21,
				0x09,
				0x0304,
				2,
				data,
				expect.any(Function),
			);
		});

		it('should handle input control transfers', async () => {
			const driver = createDriver();
			driver.open();

			const result = await driver.controlTransfer({
				bmRequestType: 0xa1,
				bRequest: 0x01,
				wValue: 0x0305,
				wIndex: 2,
				data: 15,
			});

			expect(Buffer.isBuffer(result)).toBe(true);
			expect((result as Buffer).length).toBe(15);
		});
	});

	describe('setDpi()', () => {
		it('should throw DriverError if device not open', () => {
			const driver = createDriver();
			expect(() => driver.setDpi({ dpiValues: [800, 1600, 2400, 3200, 5000, 22000] })).toThrow(DriverError);
		});

		it('should send DPI configuration via control transfer', async () => {
			const driver = createDriver();
			driver.open();

			await driver.setDpi({
				activeStage: 2,
				angleSnap: false,
				ripplerControl: true,
				dpiValues: [800, 1600, 2400, 3200, 5000, 22000],
			});

			expect(driver.device.controlTransfer).toHaveBeenCalled();
		});
	});

	describe('setPollingRate()', () => {
		it('should send polling rate via control transfer', async () => {
			const driver = createDriver();
			driver.open();

			await driver.setPollingRate(1000);

			expect(driver.device.controlTransfer).toHaveBeenCalled();
		});
	});

	describe('setUserPreferences()', () => {
		it('should send user preferences via control transfer', async () => {
			const driver = createDriver();
			driver.open();

			await driver.setUserPreferences({
				lightMode: 0x20,
				ledSpeed: 2,
				keyResponse: 4,
			});

			expect(driver.device.controlTransfer).toHaveBeenCalled();
		});
	});

	describe('setMacro()', () => {
		it('should send macro config via control transfer', async () => {
			const driver = createDriver();
			driver.open();

			await driver.setMacro({ forward: [0x12, 0x00, 0x00] });

			expect(driver.device.controlTransfer).toHaveBeenCalled();
		});
	});

	describe('reset()', () => {
		it('should call all sub-reset methods in order', async () => {
			const driver = createDriver();
			driver.open();

			const sendInternalSpy = vi.spyOn(driver, 'sendInternalStateResetReportBuilder');
			const resetDpiSpy = vi.spyOn(driver, 'resetDpi');
			const resetUserPreferencesSpy = vi.spyOn(driver, 'resetUserPreferences');
			const resetPollingRateSpy = vi.spyOn(driver, 'resetPollingRate');
			const resetMacroSpy = vi.spyOn(driver, 'resetMacro');
			const resetCustomMacroSpy = vi.spyOn(driver, 'resetCustomMacro');

			await driver.reset();

			expect(sendInternalSpy).toHaveBeenCalled();
			expect(resetDpiSpy).toHaveBeenCalled();
			expect(resetUserPreferencesSpy).toHaveBeenCalled();
			expect(resetPollingRateSpy).toHaveBeenCalled();
			expect(resetMacroSpy).toHaveBeenCalled();
			expect(resetCustomMacroSpy).toHaveBeenCalled();
		});
	});

	describe('onBatteryChange()', () => {
		it('should register a listener and return an unsubscribe function', () => {
			const driver = createDriver();
			driver.open();

			const listener = vi.fn();
			const unsubscribe = driver.onBatteryChange(listener);

			driver.emit('batteryChange', 42);
			expect(listener).toHaveBeenCalledWith(42);

			unsubscribe();
			driver.emit('batteryChange', 50);
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should throw if device not open', () => {
			const driver = createDriver();
			expect(() => driver.onBatteryChange(() => undefined)).toThrow(DriverError);
		});
	});
});
