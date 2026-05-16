import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const deviceStyles = StyleSheet.create({
	section: {
		marginBottom: 24,
	},
	deviceItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.routyDarkGray,
		padding: 16,
		borderRadius: Layout.borderRadius,
		marginBottom: 8,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: Colors.routyLightGray,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
	},
	deviceInfo: {
		flex: 1,
	},
	hostname: {
		fontSize: 17,
		fontWeight: "600",
		color: Colors.routyWhite,
		marginBottom: 2,
	},
	ip: {
		fontSize: 13,
		color: Colors.routyGray,
	},
	empty: {
		paddingTop: 100,
		alignItems: "center",
	},
	emptyText: {
		color: Colors.routyGray,
		fontSize: 16,
	},
});
