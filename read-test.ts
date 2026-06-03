import { AttackSharkX11, ConnectionMode } from './src/main/driver/index.js';

const driver = new AttackSharkX11({ connectionMode: ConnectionMode.Adapter });

try {
	await driver.open();
	console.log('Connected!');

	// Read Macros (Report 0x0308)
	console.log('Reading Macros...');
	const macroBuffer = await driver.controlTransfer({
		bmRequestType: 0xa1,
		bRequest: 0x01,
		wValue: 0x0308,
		wIndex: 2,
		data: 59,
	});
	console.log('Macro Buffer:', macroBuffer.toString('hex'));
} catch (e) {
	console.error('Error:', e);
} finally {
	await driver.close();
}
