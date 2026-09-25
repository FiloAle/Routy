import React from "react";
import { Pressable, Text, View, ViewStyle, TextStyle } from "react-native";
import { SymbolView } from "expo-symbols";

import { useThemePalette } from "../constants/Colors";
import { cardStyles } from "@/styles/cardStyles";

interface DashboardCardProps {
	label?: string;
	value?: string | number;
	children?: React.ReactNode;
	onPress?: () => void;
	onLongPress?: () => void;
	showChevron?: boolean;
	containerStyle?: ViewStyle;
	labelStyle?: TextStyle;
	valueStyle?: TextStyle;
}

export function DashboardCard({
	label,
	value,
	children,
	onPress,
	onLongPress,
	showChevron = false,
	containerStyle,
	labelStyle,
	valueStyle,
}: DashboardCardProps) {
	const palette = useThemePalette();
	const Content = (
		<View style={[cardStyles.card, containerStyle]}>
			<View style={cardStyles.headerRow}>
				{label && <Text style={[cardStyles.label, labelStyle]}>{label}</Text>}
				{showChevron && (
					<SymbolView
						name="chevron.right"
						size={10}
						weight="bold"
						tintColor={palette.secondaryText}
						style={cardStyles.chevron}
					/>
				)}
			</View>

			{value !== undefined && (
				<Text style={[cardStyles.value, valueStyle]}>{value}</Text>
			)}

			{children}
		</View>
	);

	if (onPress || onLongPress) {
		return (
			<Pressable
				onPress={onPress}
				onLongPress={onLongPress}
				style={({ pressed }) => [
					cardStyles.pressable,
					{ opacity: pressed ? 0.7 : 1 },
				]}
			>
				{Content}
			</Pressable>
		);
	}

	return <View style={cardStyles.flex1}>{Content}</View>;
}
