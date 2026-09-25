import { requireNativeModule, requireNativeView } from "expo";
import type React from "react";
import type { ImageProps } from "@expo/ui/swift-ui";
import { createModifier } from "@expo/ui/swift-ui/modifiers";

// Loading the native module runs its OnCreate, which registers the modifiers below.
const RoutyUIModifiers = requireNativeModule("RoutyUIModifiers");

/** Accent color of native alerts: the primary button's fill and plain buttons' text. */
export const setAlertTintColor = (color: string): void =>
	RoutyUIModifiers.setAlertTintColor(color);

/** Insets a SwiftUI scroll view's content from the top; see ScrollTopInsetModifier. */
export const scrollTopInset = (top: number) =>
	createModifier("routyScrollTopInset", { top });

/** Shows text as written, e.g. in grouped list section headers; see TextCaseNoneModifier. */
export const textCaseNone = () => createModifier("routyTextCaseNone");

/** Draws SF Symbols in a single color instead of their default rendering; see SymbolMonochromeModifier. */
export const symbolMonochrome = () => createModifier("routySymbolMonochrome");

/** An SF Symbol that keeps its outline inside swipe actions; see SymbolImageView. */
export const SymbolImage: React.ComponentType<{ systemName: NonNullable<ImageProps["systemName"]> }> = requireNativeView(
	"RoutyUIModifiers",
	"SymbolImageView",
);
