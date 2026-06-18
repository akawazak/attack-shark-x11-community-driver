export class DriverError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = new.target.name;
	}
}

export class ParamsError extends DriverError {
	constructor(
		public paramName: string,
		message?: string,
		options?: { cause?: unknown },
	) {
		super(message ?? `The parameter ${paramName} is missing or is not of the desired type.`, options);
	}
}

export class DeviceError extends DriverError {}

export class InterfaceError extends DriverError {
	constructor(
		message: string,
		public interfaceNumber: number,
		options?: { cause?: unknown },
	) {
		super(message, options);
	}
}

export class TimeoutError extends DriverError {}
