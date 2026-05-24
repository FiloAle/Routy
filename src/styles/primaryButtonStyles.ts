import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const primaryButtonStyles = StyleSheet.create({
	button: {
		borderRadius: Layout.borderRadius + 4,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 50,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: Colors.routyWhite,
		fontSize: 16,
		fontWeight: "600",
	},
});
