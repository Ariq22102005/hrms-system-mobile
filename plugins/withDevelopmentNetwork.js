const { withAndroidManifest } = require('expo/config-plugins');
module.exports = function withDevelopmentNetwork(config) {
  return withAndroidManifest(config, (result) => {
    result.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = ['development', 'mock'].includes(process.env.EXPO_PUBLIC_APP_ENV) ? 'true' : 'false';
    return result;
  });
};
