import React from "react";
import { StyleSheet, Text, TextStyle, StyleProp } from "react-native";

interface SectionLabelProps {
	children: string;
	style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
	return (
		<Text style={[styles.label, style]}>
			{children.toUpperCase()}
		</Text>
	);
}

const styles = StyleSheet.create({
	label: {
		fontSize: 12,
		fontWeight: "600",
		color: "#8E8E93",
		letterSpacing: 0.5,
		marginBottom: 12,
		marginTop: 24,
		marginLeft: 4,
	},
});
