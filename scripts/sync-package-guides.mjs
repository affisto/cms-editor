import {copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=new URL('../docs/extensions.md',import.meta.url);
for(const name of ['core','react','form']) copyFileSync(fileURLToPath(source),fileURLToPath(new URL(`../packages/editor-${name}/GUIDE.md`,import.meta.url)));
