import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageGuideNames = {
  "extensions.md": "GUIDE.md",
  "customization.md": "CUSTOMIZATION.md",
  "block-design.md": "BLOCK_DESIGN.md",
  "integration.md": "INTEGRATION.md",
};

export function readPackageGuides() {
  return Object.entries(packageGuideNames).map(([source, filename]) => {
    const markdown = readFileSync(
      new URL(`../docs/${source}`, import.meta.url),
      "utf8",
    );
    const content = markdown
      .replace(/\]\((?:\.\/)?([\w-]+\.md)(?=[)#])/g, (link, target) =>
        Object.hasOwn(packageGuideNames, target)
          ? `](${packageGuideNames[target]}`
          : link,
      )
      .replace(
        /\]\(\.\.\/apps\//g,
        "](https://github.com/affisto/cms-editor/blob/main/apps/",
      );
    return [filename, content];
  });
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const guides = readPackageGuides();
  for (const name of ["core", "react", "form"]) {
    for (const [filename, content] of guides) {
      writeFileSync(
        new URL(`../packages/editor-${name}/${filename}`, import.meta.url),
        content,
      );
    }
  }
}
