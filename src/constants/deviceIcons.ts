import { Platform } from "react-native";
import type { ImageProps } from "@expo/ui/swift-ui";
import { Device, isDisconnected } from "@/services/router-api";

type SymbolName = NonNullable<ImageProps["systemName"]>;

// Stored by id, not by symbol name: fallbacks and renames stay in this one map.
export const DEVICE_ICONS = [
	{ id: "iphone", symbol: "iphone" },
	{ id: "ipad", symbol: "ipad" },
	{ id: "watch", symbol: "applewatch" },
	{ id: "computer", symbol: "desktopcomputer" },
	{ id: "macbook", symbol: "macbook", legacySymbol: "laptopcomputer", minIOS: 17 },
	{ id: "tv", symbol: "tv" },
	{ id: "speaker", symbol: "homepod.and.homepod.mini", legacySymbol: "homepod.2", minIOS: 18 },
	{ id: "console", symbol: "gamecontroller" },
	{ id: "drive", symbol: "externaldrive" },
	{ id: "printer", symbol: "printer" },
	{ id: "camera", symbol: "web.camera" },
	{ id: "light", symbol: "lightbulb" },
	{ id: "doorbell", symbol: "video.doorbell" },
	{ id: "plug", symbol: "poweroutlet.type.b" },
	{ id: "wifi", symbol: "wifi" },
] as const satisfies readonly {
	id: string;
	symbol: SymbolName;
	legacySymbol?: SymbolName;
	minIOS?: number;
}[];

export type DeviceIconId = (typeof DEVICE_ICONS)[number]["id"];

const iosMajor = Platform.OS === "ios" ? parseInt(String(Platform.Version), 10) : 0;

export function isDeviceIconId(value: unknown): value is DeviceIconId {
	return DEVICE_ICONS.some((icon) => icon.id === value);
}

// `Image(systemName:)` shows nothing for a symbol the OS doesn't have, hence the fallback.
export function symbolFor(id: DeviceIconId): SymbolName {
	const icon = DEVICE_ICONS.find((i) => i.id === id)!;
	if ("minIOS" in icon && iosMajor < icon.minIOS) return icon.legacySymbol;
	return icon.symbol;
}

// First match wins; add rows to recognize more names.
const NAME_RULES: { match: RegExp; id: DeviceIconId }[] = [
	{ match: /iphone/i, id: "iphone" },
	{ match: /ipad/i, id: "ipad" },
	{ match: /macbook/i, id: "macbook" },
	{ match: /tv/i, id: "tv" },
	{ match: /nas|drive/i, id: "drive" },
];

export function inferIconFromName(hostname: string): DeviceIconId | null {
	return NAME_RULES.find((rule) => rule.match.test(hostname))?.id ?? null;
}

// Manual choice, then the name, then the connection type.
export function deviceSymbol(
	device: Pick<Device, "hostname" | "ip" | "type">,
	manualIcon: DeviceIconId | null,
): SymbolName {
	const id = manualIcon ?? inferIconFromName(device.hostname);
	if (id) return symbolFor(id);
	if (isDisconnected(device)) return "wifi.slash";
	return device.type === "cable" ? "desktopcomputer" : "wifi";
}
