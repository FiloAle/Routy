import { StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";

export const Layout = {
	borderRadius: 24,
	headerOffset: 112,
};

export const globalStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.routyBlack,
	},
	scroll: {
		paddingHorizontal: 16,
		paddingBottom: 100,
		paddingTop: Layout.headerOffset,
		gap: 28,
	},
	card: {
		backgroundColor: Colors.routyDarkGray,
		borderRadius: Layout.borderRadius,
		overflow: "hidden",
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: Colors.routyLightGray,
		marginLeft: 16,
	},
	field: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	fieldLabel: {
		fontSize: 16,
		color: Colors.routyWhite,
	},
	fieldInput: {
		flex: 1,
		fontSize: 16,
		color: Colors.routyWhite,
		textAlign: "right",
		marginLeft: 10,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	infoLabel: {
		fontSize: 16,
		color: Colors.routyWhite,
	},
	infoValue: {
		fontSize: 16,
		color: Colors.routyGray,
		fontWeight: "500",
	},
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.routyGray,
	},
	statusDotOnline: {
		backgroundColor: Colors.routyLime,
	},
	statusDotError: {
		backgroundColor: Colors.routyRed,
	},
	statusDotLoading: {
		backgroundColor: Colors.routyBlue,
	},
	sectionLabel: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.routyGray,
		letterSpacing: 0.5,
		marginLeft: 4,
	},
	dangerButton: {
		backgroundColor: Colors.routyRose,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: Layout.borderRadius + 4,
	},
	dangerButtonText: {
		color: Colors.routyWhite,
		fontSize: 16,
		fontWeight: "600",
	},
	section: {
		gap: 8,
	},
});

export default globalStyles;
