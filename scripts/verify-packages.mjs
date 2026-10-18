import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
mkdirSync(join(root, "artifacts"), { recursive: true });
const tarballs = ["core", "react", "form"].map((name) => {
  const result = JSON.parse(
    run(
      "npm",
      [
        "pack",
        `--workspace=cms-editor-${name}`,
        "--pack-destination",
        "artifacts",
        "--json",
      ],
      root,
    ),
  );
  if (!result[0].files.some(file => file.path === "GUIDE.md")) throw new Error(`Missing consumer guide: ${name}`);
  return resolve(root, "artifacts", result[0].filename);
});
const directory = mkdtempSync(join(tmpdir(), "cms-editor-consumer-"));
writeFileSync(
  join(directory, "package.json"),
  JSON.stringify({
    name: "cms-editor-consumer-smoke",
    private: true,
    type: "module",
  }),
);
run(
  "npm",
  ["install", ...tarballs, "react@18.2.0", "react-dom@18.2.0"],
  directory,
);
writeFileSync(
  join(directory, "smoke.mjs"),
  `import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {CMSRenderer} from 'cms-editor-react';
import {parseDocument,renderHTML,createSchema} from 'cms-editor-core';
import {formTemplate,FormKit} from 'cms-editor-form';
import {mountForm} from 'cms-editor-form/browser';
import {CMSForm,useCMSForm} from 'cms-editor-form/react';
import {createEditor} from 'cms-editor-core/browser';
const require=createRequire(import.meta.url);
const doc=parseDocument(formTemplate(), [FormKit]);
assert(renderHTML(doc,{extensions:[FormKit]}).includes('새로운 만남'));
assert(renderToString(React.createElement(CMSRenderer,{document:doc,extensions:[FormKit]})).includes('새로운 만남'));
assert.equal(createSchema().nodes.field,undefined);
assert.equal(typeof CMSForm,'function'); assert.equal(typeof useCMSForm,'function');
assert.equal(typeof createEditor,'function');assert.equal(typeof mountForm,'function');
assert.equal(typeof require('cms-editor-core').createDocument,'function');
assert(require.resolve('cms-editor-core/style.css').endsWith('style.css'));
assert(require.resolve('cms-editor-form/style.css').endsWith('style.css'));
assert.equal(typeof require('cms-editor-form').formTemplate,'function');
console.log('PASS: isolated tarball install, ESM/CJS exports, React SSR, browser entry and CSS resolution');`,
);
process.stdout.write(run("node", ["smoke.mjs"], directory));
const lock = JSON.parse(
  readFileSync(join(directory, "package-lock.json"), "utf8"),
);
if (!lock.packages["node_modules/cms-editor-core"])
  throw new Error("Package was not installed");
console.log(`Consumer: ${directory}`);
console.log(`Packages: ${tarballs.join(", ")}`);
