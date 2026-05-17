import React from "react";
import { Pressable, Text, View, ViewStyle, TextStyle } from "react-native";
import { NavArrowRight } from "iconoir-react-native";

import { Colors } from "../constants/Colors";
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
	const Content = (
		<View style={[cardStyles.card, containerStyle]}>
			<View style={cardStyles.headerRow}>
				{label && <Text style={[cardStyles.label, labelStyle]}>{label}</Text>}
				{showChevron && (
					<NavArrowRight
						width={14}
						height={14}
						strokeWidth={2.5}
						color={Colors.routyGray}
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
