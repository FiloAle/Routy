import React from "react";
import { Platform, TextInput, View, ViewStyle } from "react-native";
import { NativeGlassView } from "./NativeGlassView";
import { SendButton } from "./SendButton";
import Reanimated, {
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";

import { t } from "@/i18n";

import { Colors } from "../constants/Colors";
import { messageInputBarStyles as styles } from "../styles/messageInputBarStyles";

const AnimatedGlassView = Reanimated.createAnimatedComponent(NativeGlassView);

interface MessageInputBarProps {
	value: string;
	onChangeText: (text: string) => void;
	onSend: () => void;
	isSending?: boolean;
	disabled?: boolean;
	placeholder?: string;
	containerStyle?: ViewStyle;
	bottomOffset?: number; // Allows customization for different safe area implementations
}

export function MessageInputBar({
	value,
	onChangeText,
	onSend,
	isSending = false,
	disabled = false,
	placeholder = t("messages.input_placeholder"),
	containerStyle,
	bottomOffset,
}: MessageInputBarProps) {
	const isMessageReady = value.trim().length > 0;

	const animatedInputStyle = useAnimatedStyle(() => {
		return {
			marginRight: withTiming(isMessageReady ? 52 : 0, { duration: 150 }),
		};
	});

	const animatedButtonStyle = useAnimatedStyle(() => {
		const isVisible = isMessageReady;
		const opacity = isVisible ? (disabled || isSending ? 0.4 : 1) : 0;
		return {
			opacity: withTiming(opacity, { duration: 100 }),
			transform: [
				{
					scale: withTiming(isVisible ? 1 : 0.1, { duration: 150 }),
				},
			],
		};
	});

	// Use provided bottomOffset or default iOS safe area logic
	const finalBottomPadding =
		bottomOffset !== undefined ? bottomOffset : Platform.OS === "ios" ? 34 : 12;

	// The button absolute position needs to match the baseline of the input
	// Baseline is finalBottomPadding + paddingVertical of the bar (12)
	const buttonBottom = finalBottomPadding;

	return (
		<View
			style={[
				styles.inputBar,
				{
					paddingBottom: finalBottomPadding,
				},
				containerStyle,
			]}
		>
			<AnimatedGlassView
				style={[styles.inputGlass, animatedInputStyle]}
				glassEffectStyle="regular"
			>
				<TextInput
					style={styles.input}
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={Colors.routyGray}
					multiline
					maxLength={160}
				/>
			</AnimatedGlassView>

			<Reanimated.View
				style={[
					animatedButtonStyle,
					{
						position: "absolute",
						right: 16,
						bottom: finalBottomPadding,
					},
				]}
			>
				<SendButton onPress={onSend} disabled={disabled || isSending} />
			</Reanimated.View>
		</View>
	);
}

