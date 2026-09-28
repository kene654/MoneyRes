import { readFileSync, writeFileSync } from 'node:fs';

const gradlePath = new URL('../android/app/build.gradle', import.meta.url);
const source = readFileSync(gradlePath, 'utf8');
let next = source.replace(/versionName "1\.0"/, 'versionName "0.1.0"');
if (!next.includes('signingConfig signingConfigs.debug')) {
  next = next.replace(
    /release \{\n/,
    'release {\n            signingConfig signingConfigs.debug\n',
  );
}
writeFileSync(gradlePath, next);
console.log('Android release set to 0.1.0 and signed for sideload.');
