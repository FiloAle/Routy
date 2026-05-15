import React from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	ViewStyle,
	TextStyle,
} from "react-native";
import { NavArrowRight } from "iconoir-react-native";

interface DashboardCardProps {
	label?: string;
	value?: string | number;
	children?: React.ReactNode;
	onPress?: () => void;
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
	showChevron = false,
	containerStyle,
	labelStyle,
	valueStyle,
}: DashboardCardProps) {
	const Content = (
		<View style={[styles.card, containerStyle]}>
			<View style={styles.headerRow}>
				{label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
				{showChevron && (
					<NavArrowRight
						width={14}
						height={14}
						strokeWidth={2.5}
						color="#8E8E93"
						style={styles.chevron}
					/>
				)}
			</View>
			
			{value !== undefined && (
				<Text style={[styles.value, valueStyle]}>{value}</Text>
			)}
			
			{children}
		</View>
	);

	if (onPress) {
		return (
			<Pressable 
				onPress={onPress} 
				style={({ pressed }) => [
					{ flex: 1, opacity: pressed ? 0.7 : 1 }
				]}
			>
				{Content}
			</Pressable>
		);
	}

	return <View style={{ flex: 1 }}>{Content}</View>;
}

const styles = StyleSheet.create({
	card: {
		flex: 1,
		backgroundColor: "#1C1C1E",
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingTop: 13,
		paddingBottom: 16,
		gap: 7,
		marginBottom: 8,
	},
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	label: {
		fontSize: 13,
		color: "#8E8E93",
		fontWeight: "500",
	},
	value: {
		fontSize: 17,
		color: "#fff",
		fontWeight: "600",
		fontFamily: "ui-rounded",
	},
	chevron: {
		marginRight: -6,
		marginBottom: -2,
	},
});
