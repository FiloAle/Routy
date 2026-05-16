import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";
import { globalStyles } from "../styles/globalStyles";

interface SectionLabelProps {
	children?: string;
	style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children = "", style }: SectionLabelProps) {
	return (
		<Text style={[globalStyles.sectionLabel, style]}>
			{children}
		</Text>
	);
}
