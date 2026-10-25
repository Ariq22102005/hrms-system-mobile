const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Reuse the transparent source logo. Android applies tint at draw time,
// preserving the original silhouette and avoiding a white bitmap rectangle.
module.exports = function withThemedSplashLogo(config) {
  // Expo's splash plugin also writes styles, so tint must be applied after mods.
  return withFinalizedMod(config, ['android', async (result) => {
    applySplashTheme(result.modRequest.platformProjectRoot);
    return result;
  }]);
};

function applySplashTheme(platformRoot) {
    const root = path.join(platformRoot, 'app/src/main/res');
    const stylesPath = path.join(root, 'values/styles.xml');
    let styles = fs.readFileSync(stylesPath, 'utf8');
    if (!styles.includes('windowSplashScreenAnimatedIcon')) throw new Error('Expo splash theme is missing');
    styles = styles.replace(/(<item name="windowSplashScreenAnimatedIcon">)[^<]*(<\/item>)/, '$1@drawable/pti_splash_logo$2')
      .replace(/(<item name="windowSplashScreenBackground">)[^<]*(<\/item>)/, '$1@color/pti_splash_background$2');
    fs.writeFileSync(stylesPath, styles);
    for (const folder of ['drawable', 'values', 'values-night']) fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.writeFileSync(path.join(root, 'drawable/pti_splash_logo.xml'), '<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@drawable/splashscreen_logo" android:gravity="center" android:tint="@color/pti_splash_tint" />\n');
    for (const [folder, background, tint] of [['values', '#F5F2ED', '#8B0D1A'], ['values-night', '#0B0B0B', '#F5F2ED']]) {
      fs.writeFileSync(path.join(root, folder, 'pti_splash_colors.xml'), `<resources><color name="pti_splash_background">${background}</color><color name="pti_splash_tint">${tint}</color></resources>\n`);
    }
}

// Allows applying the same final mod to a local generated tree without cleaning it.
module.exports.applySplashTheme = applySplashTheme;
