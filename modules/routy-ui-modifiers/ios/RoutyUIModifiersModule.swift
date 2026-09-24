import ExpoModulesCore
import ExpoUI
import SwiftUI

/// Pushes a scrollable view's content down without clipping it: the content still scrolls
/// under overlays placed above it (like a custom header), and the pull-to-refresh control
/// appears below the inset instead of behind the overlay.
internal struct ScrollTopInsetModifier: ViewModifier, Record {
  @Field var top: CGFloat = 0

  func body(content: Content) -> some View {
    content.safeAreaInset(edge: .top, spacing: 0) {
      Color.clear.frame(height: top)
    }
  }
}

/// Keeps text as written: grouped list section headers are uppercased by default,
/// and @expo/ui's textCase modifier can't reset it to nil.
internal struct TextCaseNoneModifier: ViewModifier, Record {
  func body(content: Content) -> some View {
    content.textCase(nil)
  }
}

public class RoutyUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoutyUIModifiers")

    OnCreate {
      ViewModifierRegistry.register("routyScrollTopInset") { params, appContext, _ in
        return try ScrollTopInsetModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("routyTextCaseNone") { params, appContext, _ in
        return try TextCaseNoneModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("routyScrollTopInset")
      ViewModifierRegistry.unregister("routyTextCaseNone")
    }
  }
}
