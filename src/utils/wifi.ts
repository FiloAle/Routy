export interface SsidEntry {
	label: string;
	value: string;
}

// Two rows only when the bands have different, non-empty SSIDs; with a single
// SSID for all bands one of the two values comes back empty.
export function getSsidEntries(ssid24: string, ssid5: string): SsidEntry[] {
	const a = ssid24.trim();
	const b = ssid5.trim();
	if (a && b && a !== b) {
		return [
			{ label: "SSID 2.4GHz", value: a },
			{ label: "SSID 5GHz", value: b },
		];
	}
	const single = a || b;
	return single ? [{ label: "SSID", value: single }] : [];
}
