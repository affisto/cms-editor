# cms-editor-form

Optional form plugin for CMS Editor. The base editor has no built-in field or submit nodes.

```tsx
import { CMSEditor } from 'cms-editor-react';
import { FormKit, CMSForm, useCMSForm } from 'cms-editor-form/react';
import { formTemplate } from 'cms-editor-form';
import 'cms-editor-core/style.css';
import 'cms-editor-form/style.css';

const extensions = [FormKit];
// Keep document in component state.
<CMSEditor document={document} extensions={extensions} onChange={setDocument} />
<CMSForm document={document} onSubmit={save} />
```

For vanilla JavaScript import `FormKit` and `mountForm` from `cms-editor-form/browser`. For server validation/rendering import the DOM-free `FormKit` from `cms-editor-form`, and pass `[FormKit]` to core `parseDocument` and `renderHTML`. Additional extensions must be registered consistently in all three places.

Use `components={{field: MyQuestionEditor, submit: MySubmitEditor}}` on `CMSEditor` to replace the editor UI while retaining the form schema. Components receive `attrs`, `selected`, and validated `updateAttributes`. For a completely custom response form, `useCMSForm({document, initialAnswers, onSubmit})` supplies state, validation and submission lifecycle without rendering UI. It returns `answers`, `errors`, `status`, `error`, `setAnswer` and `submit`.

The root entry exports `FormField`, `SubmitButton`, `FormKit`, `fieldBlock`, `formTemplate`, `collectFields`, `validateAnswers`, `createSubmission` and associated types. Root definitions are DOM-free; browser/React kits also include the default editor node views. React is optional for root/browser usage. Fields support text, textarea, email, number, radio, checkbox and select.

Custom field types require consumer-owned answer validation/runtime; these helpers handle the supplied `field` schema. Upload/storage/submission endpoints remain consumer-owned. `extensions` and component maps are mount-time configuration. The built-in `CMSForm` still recreates its DOM when `document` identity changes; `useCMSForm` preserves answers for equivalent document content.

See [the extension and custom form guide](./GUIDE.md) included in this package for complete examples and migration instructions.

License: [MIT](./LICENSE).
