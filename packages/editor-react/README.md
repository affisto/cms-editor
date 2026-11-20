# cms-editor-react

React bindings for the framework-independent CMS Editor.

```tsx
import { CMSEditor, CMSRenderer, type BlockViewProps } from 'cms-editor-react';
import 'cms-editor-core/style.css';

const extensions = [MyBlock];
const components = { my_block: MyBlockEditor };
<CMSEditor document={document} onChange={setDocument}
  extensions={extensions} components={components} />
<CMSRenderer document={document} extensions={extensions} />
```

Custom `components` receive `attrs`, `selected`, and `updateAttributes(patch): boolean`. They are React portals and inherit the host application's context providers. Updates are validated and included in document history. Node and response IDs cannot be overwritten through this method. Components currently target leaf atomic blocks; use a ProseMirror NodeView/contentDOM for editable rich-text children. Use local component state for temporarily invalid input. Errors are passed to `onError`.

`components`, `extensions`, `allowedBlocks` and `nodeViews` are mount-time configuration. Change the React key to reconfigure. The instance is exposed through `ref` and `onReady`. `CMSRenderer` uses the extension's HTML renderer, not its editor component.

For forms import `FormKit`, `CMSForm` or the headless `useCMSForm` from `cms-editor-form/react`. Register the kit on `CMSEditor` and import `cms-editor-form/style.css` for its default UI. No form plugin is installed implicitly by this package.

`inspectorMode="popover"` supplies settings without a permanent sidebar; `inline` uses `inspectorRef`. Switching this prop preserves the document/history. The toolbar is absent unless `showToolbar` is enabled.

## Guides

Each npm package includes these guides in its installed directory. The links open the source on GitHub.

- [Build a custom block](https://github.com/affisto/cms-editor/blob/main/docs/extensions.md) (`GUIDE.md`)
- [Customize the editor and form UI](https://github.com/affisto/cms-editor/blob/main/docs/customization.md) (`CUSTOMIZATION.md`)
- [Block design principles](https://github.com/affisto/cms-editor/blob/main/docs/block-design.md) (`BLOCK_DESIGN.md`)
- [Integrate the editor and form runtime](https://github.com/affisto/cms-editor/blob/main/docs/integration.md) (`INTEGRATION.md`)

License: [MIT](./LICENSE).
