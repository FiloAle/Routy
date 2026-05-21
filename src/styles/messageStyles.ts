import { Dimensions, StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { Layout } from "./globalStyles";

export const messageStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.routyBlack,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.routyBlack,
		gap: 12,
		padding: 24,
	},
	statusText: {
		color: Colors.routyGray,
		fontSize: 15,
	},
	errorIcon: {
		fontSize: 40,
	},
	errorText: {
		color: Colors.routyRed,
		fontSize: 16,
		fontWeight: "600",
		textAlign: "center",
	},
	errorHint: {
		color: Colors.routyGray,
		fontSize: 13,
		textAlign: "center",
		lineHeight: 18,
	},
	retryButton: {
		marginTop: 8,
		paddingHorizontal: 24,
		paddingVertical: 12,
		backgroundColor: Colors.routyBlue,
		borderRadius: Layout.borderRadius,
	},
	retryButtonText: {
		color: Colors.routyWhite,
		fontWeight: "600",
		fontSize: 15,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
	},
	rowContent: {
		flex: 1,
		gap: 2,
	},
	rowHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	rowName: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.routyWhite,
		flex: 1,
		marginRight: 8,
	},
	rowDate: {
		fontSize: 13,
		color: Colors.routyGray,
	},
	rowFooter: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	rowPreview: {
		fontSize: 14,
		color: Colors.routyGray,
		flex: 1,
		marginRight: 4,
	},
	rowPreviewUnread: {
		color: Colors.routyWhite,
		fontWeight: "600",
	},
	rowRightSide: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	unreadDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: Colors.routyBlue,
		marginTop: 1,
	},
	avatar: {
		width: 50,
		height: 50,
		borderRadius: 25,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarText: {
		fontSize: 24,
		color: Colors.routyWhite,
		fontWeight: "700",
		fontFamily: "ui-rounded",
		marginTop: -2,
		textAlign: "center",
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: Colors.routyLightGray,
		marginLeft: 78,
	},
	deleteActionWrapper: {
		justifyContent: "center",
		alignItems: "flex-end",
		paddingHorizontal: 12,
		backgroundColor: "transparent",
		overflow: "hidden",
	},
	deleteAction: {
		backgroundColor: Colors.routyRed,
		height: 50,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
	},
	deleteActionButton: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
	},
	header: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 11,
		paddingTop: 60,
		paddingBottom: 8,
		paddingHorizontal: 16,
		backgroundColor: "transparent",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: "700",
		color: Colors.routyWhite,
		letterSpacing: 0.4,
	},
	composeButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: -2,
	},
	modalContainer: {
		flex: 1,
		backgroundColor: Colors.routyDarkGray,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 30,
		paddingVertical: 30,
	},
	modalTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: Colors.routyWhite,
		marginBottom: 2,
	},
	closeButtonContainer: {
		position: "absolute",
		right: 20,
	},
	closeButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
	},
	recipientGlassContainer: {
		marginHorizontal: 20,
		borderRadius: 99,
		overflow: "hidden",
	},
	recipientField: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		minHeight: 50,
	},
	recipientLabel: {
		fontSize: 16,
		color: Colors.routyGray,
		marginRight: 8,
	},
	recipientInput: {
		flex: 1,
		fontSize: 16,
		color: Colors.routyWhite,
		paddingVertical: 4,
	},
	suggestionsContainer: {
		backgroundColor: Colors.routyDarkGray,
		maxHeight: 200,
	},
	suggestionItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: Colors.routyLightGray,
	},
	suggestionName: {
		fontSize: 16,
		color: Colors.routyWhite,
		fontWeight: "600",
	},
	suggestionNumber: {
		fontSize: 13,
		color: Colors.routyGray,
		marginTop: 2,
	},
	selectedRecipientWrapper: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	selectedRecipientName: {
		fontSize: 16,
		color: Colors.routyWhite,
		fontWeight: "600",
	},
	selectedRecipientNumber: {
		fontSize: 16,
		color: Colors.routyGray,
	},
	removeRecipientButton: {
		marginLeft: "auto",
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "rgba(255,255,255,0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	emptyContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingTop: 100,
		gap: 12,
	},
	emptyIcon: {
		fontSize: 40,
	},
	emptyText: {
		color: Colors.routyGray,
		fontSize: 16,
	},
	listContent: {
		paddingHorizontal: 8,
		paddingTop: Layout.headerOffset,
		paddingBottom: 84,
		flexGrow: 1,
		justifyContent: "flex-end",
	},
	dateSeparator: {
		alignItems: "center",
		marginVertical: 12,
	},
	dateSeparatorText: {
		fontSize: 12,
		color: Colors.routyGray,
	},
	bubbleRow: {
		flexDirection: "row",
		justifyContent: "flex-start",
		marginVertical: 1,
		paddingHorizontal: 8,
	},
	bubbleRowSent: {
		justifyContent: "flex-end",
	},
	bubble: {
		maxWidth: "75%",
		paddingHorizontal: 14,
		paddingTop: 8,
		paddingBottom: 10,
		borderRadius: Layout.borderRadius - 4,
	},
	bubbleReceived: {
		backgroundColor: Colors.routyDarkGray,
	},
	bubbleSent: {
		backgroundColor: Colors.routyBlue,
	},
	bubbleText: {
		fontSize: 16,
		color: Colors.routyWhite,
		lineHeight: 22,
	},
	headerGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 120,
	},
	flex1: {
		flex: 1,
	},
	chatList: {
		flex: 1,
		marginBottom: -90,
	},
	keyboardAvoidingView: {
		flex: 1,
	},
	headerComposeIcon: {
		marginTop: -2,
	},
	listContainer: {
		minHeight: Dimensions.get("window").height - Layout.headerOffset - 90,
		paddingBottom: 100,
		paddingHorizontal: 0,
	},
});

export default messageStyles;
