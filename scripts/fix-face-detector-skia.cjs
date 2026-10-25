// react-native-vision-camera-face-detector 1.10.x calls useSkiaFrameProcessor() on every render,
// even when the optional `skiaActions` prop is not used. That hook throws
// "@shopify/react-native-skia is not installed!" when Skia is absent, which crashes the face camera.
// Only create the Skia frame processor when `skiaActions` is actually provided.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.dirname(require.resolve('react-native-vision-camera-face-detector/package.json'));
const filename = path.join(dir, 'src/Camera.tsx');
let source = fs.readFileSync(filename, 'utf8');
const marker = '/* Aranus: Skia frame processor only when skiaActions is provided. */';
if (source.includes(marker)) process.exit(0);
const before = 'const skiaFrameProcessor = useSkiaFrameProcessor(';
if (source.split(before).length !== 2) throw new Error('react-native-vision-camera-face-detector changed: review the Skia patch before building.');
source = source.replace(before, `${marker}\n  const skiaFrameProcessor = !skiaActions ? undefined : useSkiaFrameProcessor(`);
fs.writeFileSync(filename, source);
console.log('Applied face-detector optional Skia fix.');