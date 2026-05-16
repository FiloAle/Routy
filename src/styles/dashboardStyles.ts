import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const dashboardStyles = StyleSheet.create({
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
		height: 120,
		zIndex: 10,
	},
	usageCard: {
		flexDirection: "row",
		backgroundColor: Colors.routyDarkGray,
		borderRadius: Layout.borderRadius,
		padding: 20,
		alignItems: "center",
		gap: 24,
	},
	chartSection: {
		position: "relative",
		justifyContent: "center",
		alignItems: "center",
	},
	chartTextContainer: {
		position: "absolute",
		justifyContent: "center",
		alignItems: "center",
	},
	chartValue: {
		fontSize: 24,
		fontWeight: "800",
		color: Colors.routyWhite,
		fontFamily: "ui-rounded",
	},
	chartSubtext: {
		fontSize: 11,
		color: Colors.routyGray,
		fontWeight: "600",
	},
	statsSection: {
		flex: 1,
		gap: 16,
	},
	statGroup: {
		gap: 2,
	},
	statLabel: {
		fontSize: 15,
		fontWeight: "400",
		color: Colors.routyWhite,
	},
	statValueMain: {
		fontSize: 26,
		fontWeight: "700",
		fontFamily: "ui-rounded",
	},
	valueRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 2,
	},
	unitText: {
		fontSize: 14,
		fontWeight: "800",
		fontFamily: "ui-rounded",
	},
	infoRow: {
		flexDirection: "row",
		gap: 8,
	},
	infoValueSmall: {
		fontSize: 17,
		color: Colors.routyWhite,
		fontWeight: "600",
		fontFamily: "ui-rounded",
	},
	speedValueContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
});
