import { requireNativeModule } from "expo";
import { createModifier } from "@expo/ui/swift-ui/modifiers";

// Loading the native module runs its OnCreate, which registers the modifiers below.
requireNativeModule("RoutyUIModifiers");

/** Insets a SwiftUI scroll view's content from the top; see ScrollTopInsetModifier. */
export const scrollTopInset = (top: number) =>
	createModifier("routyScrollTopInset", { top });
