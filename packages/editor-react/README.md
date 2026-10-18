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

See [the extension and custom form guide](./GUIDE.md) included in this package for complete examples and migration instructions.

License: [MIT](./LICENSE).
