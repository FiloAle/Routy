import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";

export const settingsStyles = StyleSheet.create({
	header: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 11,
		backgroundColor: "transparent",
		paddingHorizontal: 16,
		paddingBottom: 8,
		paddingTop: 60,
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: "700",
		color: Colors.routyWhite,
		letterSpacing: 0.4,
	},
	headerGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 140,
		zIndex: 10,
	},
	unitSelector: {
		flexDirection: "row",
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		borderRadius: 24,
		padding: 2,
	},
	unitButton: {
		width: 40,
		paddingVertical: 6,
		borderRadius: 24,
		justifyContent: "center",
		alignItems: "center",
	},
	unitButtonActive: {
		backgroundColor: Colors.routyBlue,
		borderRadius: 24,
	},
	unitText: {
		color: Colors.routyGray,
		fontSize: 12,
		fontWeight: "600",
	},
	unitTextActive: {
		color: Colors.routyWhite,
	},
	fieldRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	dataLimitInput: {
		textAlign: "right",
		marginRight: 12,
		flex: 0,
		minWidth: 60,
	},
});
