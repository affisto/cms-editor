import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readPackageGuides } from "./sync-package-guides.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const guideFiles = [
  "GUIDE.md",
  "CUSTOMIZATION.md",
  "BLOCK_DESIGN.md",
  "INTEGRATION.md",
];
const expectedGuides = new Map(readPackageGuides());
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
mkdirSync(join(root, "artifacts"), { recursive: true });
const privatePackages = new Set();
for (const group of ["apps", "packages"]) {
  for (const workspace of readdirSync(join(root, group), {
    withFileTypes: true,
  })) {
    if (!workspace.isDirectory()) continue;
    const manifest = JSON.parse(
      readFileSync(join(root, group, workspace.name, "package.json"), "utf8"),
    );
    if (manifest.private) privatePackages.add(manifest.name);
  }
}
const tarballs = ["core", "react", "form"].map((name) => {
  const directory = `packages/editor-${name}`;
  const manifest = JSON.parse(
    readFileSync(join(root, directory, "package.json"), "utf8"),
  );
  if (
    manifest.private ||
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig?.registry !== "https://registry.npmjs.org/" ||
    manifest.repository?.url !==
      "git+https://github.com/affisto/cms-editor.git" ||
    manifest.repository?.directory !== directory ||
    !manifest.bugs?.url ||
    !manifest.homepage ||
    manifest.license !== "MIT"
  ) {
    throw new Error(`Invalid npm publishing metadata for ${manifest.name}`);
  }
  for (const dependencies of [
    manifest.dependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ]) {
    for (const dependency of Object.keys(dependencies ?? {})) {
      if (privatePackages.has(dependency)) {
        throw new Error(
          `${manifest.name} depends on private workspace ${dependency}`,
        );
      }
    }
  }
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
  const packedFiles = new Set(result[0].files.map((file) => file.path));
  const exportFiles = Object.values(manifest.exports).flatMap((entry) =>
    typeof entry === "string" ? [entry] : Object.values(entry),
  );
  for (const path of ["README.md", "LICENSE", ...guideFiles, ...exportFiles]) {
    if (!packedFiles.has(path.replace(/^\.\//, ""))) {
      throw new Error(`Missing ${path} in ${manifest.name}`);
    }
  }
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
for (const name of ["core", "react", "form"]) {
  const packageDir = join(directory, "node_modules", `cms-editor-${name}`);
  for (const filename of ["README.md", ...guideFiles]) {
    const content = readFileSync(join(packageDir, filename), "utf8");
    const expected =
      filename === "README.md"
        ? readFileSync(join(root, `packages/editor-${name}`, filename), "utf8")
        : expectedGuides.get(filename);
    if (content !== expected) {
      throw new Error(`Unexpected ${filename} in installed cms-editor-${name}`);
    }
    for (const [, link] of content.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith("#")) continue;
      const target = decodeURIComponent(link.split("#")[0]);
      if (!existsSync(join(packageDir, target))) {
        throw new Error(
          `Broken link in cms-editor-${name}/${filename}: ${link}`,
        );
      }
    }
  }
}
console.log(
  "PASS: all four guides and README match their sources and local links resolve",
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
