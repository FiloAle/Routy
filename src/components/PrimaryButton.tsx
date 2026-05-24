import React from "react";
import {
	ActivityIndicator,
	Pressable,
	Text,
	ViewStyle,
} from "react-native";

import { Colors } from "../constants/Colors";
import { primaryButtonStyles as styles } from "../styles/primaryButtonStyles";

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
	color = Colors.routyBlue,
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
				<ActivityIndicator color={Colors.routyWhite} />
			) : (
				<Text style={styles.buttonText}>{label}</Text>
			)}
		</Pressable>
	);
}

