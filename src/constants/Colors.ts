import { DynamicColorIOS, Platform, useColorScheme } from "react-native";

// Hex values per appearance. Styles use `Colors` below; `useThemePalette()` returns
// these plain strings where a dynamic color can't be used (SwiftUI modifiers,
// gradients, SF Symbol palettes).
export const DarkPalette = {
	background: "#000000", // Screens with cards
	plainBackground: "#000000", // Message list and chat
	card: "#1C1C1E", // Cards, sheets
	bubbleReceived: "#1C1C1E",
	separator: "#3A3A3C", // Divider lines
	fill: "#3A3A3C", // Icon wells, switch tracks
	pickerFill: "#3A3A3C", // Unselected cells of the device icon picker
	text: "#FFFFFF", // Primary text
	secondaryText: "#8E8E93",
	lime: "#A7FF00", // Sent data
	rose: "#FF2D55", // Received data, destructive button
	subtleFill: "rgba(255, 255, 255, 0.05)",
	faintFill: "rgba(255, 255, 255, 0.1)",
	hairline: "rgba(255, 255, 255, 0.15)",
	glassBorder: "rgba(255, 255, 255, 0)", // Glass is already visible on black
	avatarGradient: ["#3A3A3C", "#1C1C1E"],
};

export const LightPalette: typeof DarkPalette = {
	background: "#FFFFFF",
	plainBackground: "#FFFFFF",
	card: "#F2F2F7",
	bubbleReceived: "#E9E9EB",
	separator: "#C6C6C8",
	fill: "#D8D8DD", // Readable on the gray cards
	pickerFill: "#FFFFFF", // Stands out on the light sheet
	text: "#000000",
	secondaryText: "#6C6C70", // #8E8E93 is too close to the gray cards
	lime: "#4C9A00", // #A7FF00 is unreadable on white
	rose: "#EB2951", // Slightly darker for contrast on white
	subtleFill: "rgba(0, 0, 0, 0.05)",
	faintFill: "rgba(0, 0, 0, 0.08)",
	hairline: "rgba(0, 0, 0, 0.1)",
	glassBorder: "rgba(0, 0, 0, 0.12)", // Outlines light glass on white
	avatarGradient: ["#A5ABB8", "#858994"],
};

// Resolved by iOS for the current appearance, so static StyleSheets follow the system.
// DynamicColorIOS doesn't exist on Android, which keeps the dark palette.
const dynamic = (key: keyof Omit<typeof DarkPalette, "avatarGradient">) =>
	Platform.OS === "ios"
		? DynamicColorIOS({ light: LightPalette[key], dark: DarkPalette[key] })
		: DarkPalette[key];

export const Colors = {
	routyBlue: "#208AEF",
	routyGreen: "#30D158", // System green
	routyOrange: "#FF9F0A", // Loading/Orange
	routyRed: "#FF3B30", // Error red
	routyWhite: "#FFFFFF", // Only on colored backgrounds (blue buttons, sent bubbles, avatars)
	routyTransparent: "transparent",

	// Adaptive
	background: dynamic("background"),
	plainBackground: dynamic("plainBackground"),
	card: dynamic("card"),
	bubbleReceived: dynamic("bubbleReceived"),
	separator: dynamic("separator"),
	fill: dynamic("fill"),
	text: dynamic("text"),
	routyGray: dynamic("secondaryText"), // Secondary text
	routyLime: dynamic("lime"),
	routyRose: dynamic("rose"),
	subtleFill: dynamic("subtleFill"),
	faintFill: dynamic("faintFill"),
	hairline: dynamic("hairline"),
	glassBorder: dynamic("glassBorder"),
};

export function useThemePalette() {
	const scheme = useColorScheme();
	// Android styles stay dark (see `dynamic`), so keep the plain values in sync.
	return Platform.OS === "ios" && scheme === "light" ? LightPalette : DarkPalette;
}

export default Colors;
