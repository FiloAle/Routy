import React from "react";
import { Host, Button } from "@expo/ui/swift-ui";
import {
	labelStyle,
	foregroundStyle,
	frame,
	glassEffect,
	padding,
} from "@expo/ui/swift-ui/modifiers";

interface ComposeButtonProps {
	onPress: () => void;
}

export function ComposeButton({ onPress }: ComposeButtonProps) {
	return (
		<Host matchContents style={{ overflow: "visible" }}>
			<Button
				label="Compose"
				systemImage="square.and.pencil"
				modifiers={[
					labelStyle("iconOnly"),
					foregroundStyle("white"),
					padding({ bottom: 2 }),
					frame({ width: 44, height: 44 }),
					glassEffect({
						glass: { variant: "regular", interactive: true },
						shape: "ellipse",
					}),
				]}
				onPress={onPress}
			/>
		</Host>
	);
}
