import React from "react";
import {
	Platform,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
	ViewStyle,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import Reanimated, {
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";

const AnimatedGlassView = Reanimated.createAnimatedComponent(GlassView);

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
	placeholder = "Messaggio di testo · SMS",
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
					paddingTop: 12,
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
					placeholderTextColor="#636366"
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
				<TouchableOpacity
					onPress={onSend}
					disabled={disabled || isSending}
					activeOpacity={0.7}
				>
					<View
						style={[
							styles.sendButton,
							(disabled || isSending) && { opacity: 0.5 },
						]}
					>
						<AnimatedGlassView
							style={StyleSheet.absoluteFill}
							glassEffectStyle="regular"
						/>
						<SymbolView
							name="arrow.up"
							size={18}
							tintColor="#fff"
							weight="bold"
						/>
					</View>
				</TouchableOpacity>
			</Reanimated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	inputBar: {
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: 16,
		backgroundColor: "transparent",
		marginBottom: 12,
	},
	inputGlass: {
		flex: 1,
		borderRadius: 22,
		overflow: "hidden",
	},
	input: {
		minHeight: 40,
		maxHeight: 120,
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 10,
		color: "#fff",
		fontSize: 16,
	},
	sendButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#007AFF",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.15)",
	},
});
