import React from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	ViewStyle,
} from "react-native";

interface PrimaryButtonProps {
	label: string;
	onPress: () => void;
	isLoading?: boolean;
	disabled?: boolean;
	color?: string;
	style?: ViewStyle;
}

export function PrimaryButton({
	label,
	onPress,
	isLoading = false,
	disabled = false,
	color = "#3B82F6",
	style,
}: PrimaryButtonProps) {
	return (
		<Pressable
			style={[
				styles.button,
				{ backgroundColor: color },
				(disabled || isLoading) && styles.buttonDisabled,
				style,
			]}
			onPress={onPress}
			disabled={disabled || isLoading}
		>
			{isLoading ? (
				<ActivityIndicator color="#fff" />
			) : (
				<Text style={styles.buttonText}>{label}</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 50,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
});
