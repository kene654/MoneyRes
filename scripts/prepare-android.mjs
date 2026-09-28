import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const gradlePath = new URL('../android/app/build.gradle', import.meta.url);
const source = readFileSync(gradlePath, 'utf8');
let next = source.replace(/versionName "[^"]+"/, `versionName "${version}"`);
if (!next.includes('signingConfig signingConfigs.debug')) {
  next = next.replace(
    /release \{\n/,
    'release {\n            signingConfig signingConfigs.debug\n',
  );
}
writeFileSync(gradlePath, next);
console.log(`Android release set to ${version} and signed for sideload.`);
