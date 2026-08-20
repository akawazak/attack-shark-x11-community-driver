# Battery Status Protocol

The X11-compatible 2.4 GHz receiver emits battery reports over USB interrupt input. Wired mode does not expose this receiver stream, and Bluetooth is not supported.

## Report format

- Interface: `2`
- Interrupt IN endpoint: `0x83`
- Minimum report length: 5 bytes
- Required prefix: `03 55 40 01`
- Battery value: byte 4, decimal `0` through `100`

For example, `03 55 40 01 50` reports `0x50`, or 80 percent.

The receiver pushes reports; the driver does not send a mouse-memory command to request them. Reading the battery therefore does not use the 500 ms write safety interval.

## Reliability filter

Receiver reports can contain transient values, including a short jump from a value in the low 90s to 100 and back. Showing every raw byte makes the UI look unreliable, so the app separates raw diagnostics from the displayed value:

1. It validates the prefix, length, integer value, and `0–100` range.
2. It collects three valid startup samples and displays their median.
3. It accepts normal changes of at most five percentage points.
4. It requires three matching reports before accepting an increase or drop larger than five points.
5. Unchanged valid reports refresh the reading's timestamp without repeatedly notifying the UI.
6. It marks a value stale after two minutes without an accepted report.
7. It retains the latest 50 decisions in Device Info for diagnosis.

Filtering changes only what is displayed. Raw reports are never written back to the device.

## Platform transports

Linux reads endpoint `0x83` through the asynchronous USB transport. Windows opens the expected interface-2 HID feature collection and its matching battery input collection. The first valid reading is shown as provisional while three reports are collected for the startup median. Reads and writes remain asynchronous so a device timeout cannot freeze the renderer.

The current protocol does not expose a trustworthy charging-state flag. The app therefore shows wired state instead of inventing a battery percentage while connected by cable.

When both the receiver and a wired identity are present, the app prefers the wired device. It rechecks connected device identities every 30 seconds so plugging or removing the charging cable can switch modes without restarting the app. The check is intentionally infrequent because HID enumeration consumes system and USB-bus resources.
