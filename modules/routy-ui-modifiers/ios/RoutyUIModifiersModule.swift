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

/// Draws SF Symbols in one color: some, like `homepod.and.homepod.mini`, default to
/// hierarchical rendering, and @expo/ui has no symbolRenderingMode modifier.
internal struct SymbolMonochromeModifier: ViewModifier, Record {
  func body(content: Content) -> some View {
    content.symbolRenderingMode(.monochrome)
  }
}

public final class SymbolImageViewProps: UIBaseViewProps {
  @Field var systemName: String = ""
}

/// An SF Symbol drawn from a UIImage, so it keeps the variant it's named after.
/// Swipe actions turn symbol images into their `.fill` variant, ignoring `.symbolVariant`.
public struct SymbolImageView: ExpoSwiftUI.View {
  @ObservedObject public var props: SymbolImageViewProps

  public init(props: SymbolImageViewProps) {
    self.props = props
  }

  public var body: some View {
    if let image = UIImage(systemName: props.systemName) {
      Image(uiImage: image.withRenderingMode(.alwaysTemplate))
    }
  }
}

/// Makes the screen's scroll view draw its top edge effect (the soft blur under the
/// navigation bar) below this view. The navigation bar asks for the same effect, but
/// UIKit only applies it once a push transition ends, so on its own the blur pops in
/// after the screen has slid in; this view is part of the screen and slides with it.
public final class ScrollEdgeContainerView: ExpoView {
  // The edge effect takes its shape from the container's elements, so an empty
  // container draws nothing: this clear label spans the whole header area.
  private let shapeLabel = UILabel()
  private var interaction: AnyObject?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    shapeLabel.text = "\u{00A0}"
    shapeLabel.textColor = .clear
    shapeLabel.isAccessibilityElement = false
    addSubview(shapeLabel)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    shapeLabel.frame = bounds
    attachIfNeeded()
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    attachIfNeeded()
  }

  private func attachIfNeeded() {
    guard #available(iOS 26.0, *), interaction == nil, window != nil,
      let scrollView = screenScrollView() else { return }
    let edgeInteraction = UIScrollEdgeElementContainerInteraction()
    edgeInteraction.scrollView = scrollView
    edgeInteraction.edge = .top
    addInteraction(edgeInteraction)
    interaction = edgeInteraction
  }

  /// The first scroll view, breadth-first, in the enclosing react-native-screens screen.
  private func screenScrollView() -> UIScrollView? {
    var root: UIView = self
    while let parent = root.superview,
      !String(describing: type(of: root)).contains("RNSScreenView") {
      root = parent
    }
    var queue: [UIView] = [root]
    while !queue.isEmpty {
      let view = queue.removeFirst()
      if let scrollView = view as? UIScrollView { return scrollView }
      queue.append(contentsOf: view.subviews)
    }
    return nil
  }
}

public class RoutyUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RoutyUIModifiers")

    // Alerts take their accent (the primary button's fill, plain button text) from
    // the tint; destructive buttons keep the system red, which UIKit doesn't expose.
    Function("setAlertTintColor") { (color: UIColor) in
      DispatchQueue.main.async {
        UIView.appearance(whenContainedInInstancesOf: [UIAlertController.self]).tintColor = color
      }
    }

    ExpoUIView(SymbolImageView.self)

    View(ScrollEdgeContainerView.self) {}

    OnCreate {
      ViewModifierRegistry.register("routyScrollTopInset") { params, appContext, _ in
        return try ScrollTopInsetModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("routyTextCaseNone") { params, appContext, _ in
        return try TextCaseNoneModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("routySymbolMonochrome") { params, appContext, _ in
        return try SymbolMonochromeModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("routyScrollTopInset")
      ViewModifierRegistry.unregister("routyTextCaseNone")
      ViewModifierRegistry.unregister("routySymbolMonochrome")
    }
  }
}
