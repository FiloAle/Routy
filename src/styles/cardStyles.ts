import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const cardStyles = StyleSheet.create({
	card: {
		flex: 1,
		backgroundColor: Colors.routyDarkGray,
		borderRadius: Layout.borderRadius,
		paddingHorizontal: 16,
		paddingTop: 13,
		paddingBottom: 16,
		gap: 8,
	},
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	label: {
		fontSize: 13,
		color: Colors.routyGray,
		fontWeight: "500",
	},
	value: {
		fontSize: 17,
		color: Colors.routyWhite,
		fontWeight: "600",
		fontFamily: "ui-rounded",
	},
	chevron: {
		marginLeft: 4,
	},
	pressable: {
		flex: 1,
	},
	flex1: {
		flex: 1,
	},
});
