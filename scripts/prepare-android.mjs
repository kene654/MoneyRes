import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const [major, minor, patch] = version.split('.').map((part) => Number(part) || 0);
const versionCode = major * 10000 + minor * 100 + patch;
const gradlePath = new URL('../android/app/build.gradle', import.meta.url);
const source = readFileSync(gradlePath, 'utf8');
let next = source
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
if (!next.includes('signingConfig signingConfigs.debug')) {
  next = next.replace(
    /release \{\n/,
    'release {\n            signingConfig signingConfigs.debug\n',
  );
}
writeFileSync(gradlePath, next);
console.log(`Android release set to ${version} and signed for sideload.`);
