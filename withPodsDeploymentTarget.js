const { withPodfile } = require('@expo/config-plugins');

const TAG = '# @generated withPodsDeploymentTarget';

// React Native's post_install raises the deployment target of each pod's main target only,
// not of their resource bundle targets (e.g. RNCAsyncStorage_resources, RNSVGFilters).
// Xcode 27 rejects deployment targets below iOS 15 as an error, so raise every Pods target.
const SNIPPET = `
    ${TAG}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        minimum = Helpers::Constants.min_ios_version_supported
        if current && current.to_f < minimum.to_f
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum
        end
      end
    end
`;

const withPodsDeploymentTarget = (config) => {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    if (podfile.includes(TAG)) return config;

    const anchor = /post_install do \|installer\|\n/;
    if (!anchor.test(podfile)) {
      throw new Error('[withPodsDeploymentTarget] post_install block not found in Podfile');
    }
    config.modResults.contents = podfile.replace(anchor, (match) => match + SNIPPET);
    return config;
  });
};

module.exports = withPodsDeploymentTarget;
