# cms-editor-core

Framework-independent block editor powered by ProseMirror. Form functionality is an optional plugin, not a dependency of this package.

```ts
import { createDocument, parseDocument, renderHTML } from 'cms-editor-core';
import { createEditor } from 'cms-editor-core/browser';
import 'cms-editor-core/style.css';

const editor = createEditor(element, {
  document: createDocument('My document'),
  extensions: [MyBlock],
  onChange: value => save(value),
});
// editor.destroy() on unmount
```

Root exports are DOM-free: schema-versioned JSON, validation, schema creation, document templates and HTML rendering. The browser entry mounts the editor. Define a `BlockExtension` with `name`, `label`, `spec`, optional `validate`, `menu`, `renderHTML`, `nodeView` and `uniqueAttributes`. Bundle definitions as `{name, extensions:[...]}`. Register the same definitions when editing, parsing and rendering. Duplicate names are rejected; unknown document types are not silently removed.

Install `cms-editor-form` and register its `FormKit` to use the supplied questions, submit button and response runtime. Data persistence, uploads and network endpoints belong to the consumer. `allowedBlocks` restricts insertion UI, not authorization. Native popovers require a modern browser. UI text currently defaults to Korean.

## Guides

Each npm package includes these guides in its installed directory. The links open the source on GitHub.

- [Build a custom block](https://github.com/affisto/cms-editor/blob/main/docs/extensions.md) (`GUIDE.md`)
- [Customize the editor and form UI](https://github.com/affisto/cms-editor/blob/main/docs/customization.md) (`CUSTOMIZATION.md`)
- [Block design principles](https://github.com/affisto/cms-editor/blob/main/docs/block-design.md) (`BLOCK_DESIGN.md`)
- [Integrate the editor and form runtime](https://github.com/affisto/cms-editor/blob/main/docs/integration.md) (`INTEGRATION.md`)

License: [MIT](./LICENSE).
