// VisionCamera 4.7.3 is built against CameraX 1.5.0-alpha03 and uses an internal class
// (androidx.camera.camera2.internal.Camera2CameraInfoImpl). expo-camera 57 asks for CameraX 1.6.0, and
// Gradle picks the highest version, so that class is missing at runtime and the camera module crashes.
// This plugin pins the CameraX artifacts that VisionCamera uses to the version it was built for.
const { withProjectBuildGradle } = require('expo/config-plugins');

const CAMERAX_VERSION = '1.5.0-alpha03';
const MARKER = '// camerax-pin (withCameraXPin plugin)';
const ARTIFACTS = ['camera-core', 'camera-camera2', 'camera-lifecycle', 'camera-video', 'camera-view', 'camera-extensions'];

module.exports = function withCameraXPin(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('withCameraXPin: android/build.gradle must be Groovy');
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `
${MARKER}
allprojects {
  configurations.configureEach {
    resolutionStrategy.eachDependency { details ->
      if (details.requested.group == 'androidx.camera' && ${JSON.stringify(ARTIFACTS)}.contains(details.requested.name)) {
        details.useVersion '${CAMERAX_VERSION}'
        details.because 'VisionCamera 4.7.3 needs the CameraX version it was built against'
      }
    }
  }
}
`;
    }
    return cfg;
  });
};
