import React from "react";
import { Host, Button } from "@expo/ui/swift-ui";
import {
	labelStyle,
	foregroundStyle,
	frame,
	glassEffect,
} from "@expo/ui/swift-ui/modifiers";
import { Colors } from "../constants/Colors";

interface SendButtonProps {
	onPress: () => void;
	disabled?: boolean;
}

export function SendButton({ onPress, disabled }: SendButtonProps) {
	return (
		<Host
			matchContents
			style={{ overflow: "visible", opacity: disabled ? 0.5 : 1 }}
		>
			<Button
				label="Send"
				systemImage="arrow.up"
				modifiers={[
					labelStyle("iconOnly"),
					foregroundStyle("white"),
					frame({ width: 40, height: 40 }),
					glassEffect({
						glass: {
							variant: "regular",
							interactive: true,
							tint: Colors.routyBlue,
						},
						shape: "ellipse",
					}),
				]}
				onPress={onPress}
			/>
		</Host>
	);
}
