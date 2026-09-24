import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const messageInputBarStyles = StyleSheet.create({
	inputBar: {
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: 16,
		backgroundColor: "transparent",
		marginBottom: 12,
		paddingTop: 19,
	},
	inputGlass: {
		flex: 1,
		borderRadius: Layout.borderRadius + 10,
		overflow: "hidden",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: Colors.glassBorder,
	},
	input: {
		minHeight: 40,
		maxHeight: 120,
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 10,
		color: Colors.text,
		fontSize: 16,
	},
	sendButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.routyBlue,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 1,
		borderColor: Colors.hairline,
	},
});
