const { readFileSync } = require('node:fs');
const pkg = JSON.parse(readFileSync('package.json'));
const app = JSON.parse(readFileSync('app.json'));
const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag || '') || tag !== `v${pkg.version}` || app.expo.version !== pkg.version) throw new Error('Tag, package.json and app.json must use the same semantic version.');
