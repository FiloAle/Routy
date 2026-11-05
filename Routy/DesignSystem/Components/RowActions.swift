import SwiftUI

extension View {
	/// A row's actions: swiped in from the trailing edge, as icons. On the Mac also on right click,
	/// with their names: a mouse has no swipe.
	func rowActions<Actions: View>(@ViewBuilder _ actions: () -> Actions) -> some View {
		let actions = actions()
		return swipeActions(edge: .trailing) { actions.labelStyle(.iconOnly) }
		#if targetEnvironment(macCatalyst)
			.contextMenu { actions }
		#endif
	}
}
