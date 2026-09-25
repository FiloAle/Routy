const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

// iOS 27 stops apps at launch unless they adopt the scene life cycle. Expo SDK 57
// ships ExpoAppSceneDelegate for this, but its template doesn't use it yet:
// register it as the scene delegate and let it create the window.

const WINDOW_SETUP = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const withSceneManifest = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            // Objective-C name of Expo's ExpoAppSceneDelegate.
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle only supports a Swift AppDelegate');
    }
    let contents = config.modResults.contents;

    // The scene delegate reads the factory from the app delegate through this protocol.
    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      const declaration = 'class AppDelegate: ExpoAppDelegate {';
      if (!contents.includes(declaration)) {
        throw new Error('withSceneLifecycle: AppDelegate declaration not found');
      }
      contents = contents.replace(
        declaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }

    // The window now comes from the connecting scene, not from launch.
    if (contents.includes(WINDOW_SETUP)) {
      contents = contents.replace(
        WINDOW_SETUP,
        '    // The window and React Native start in ExpoAppSceneDelegate (see withSceneLifecycle.js).\n',
      );
    } else if (contents.includes('window = UIWindow(frame: UIScreen.main.bounds)')) {
      throw new Error('withSceneLifecycle: unexpected window setup in AppDelegate');
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
