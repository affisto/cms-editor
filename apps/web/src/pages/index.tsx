import * as React from "react";
import type { HeadProps, PageProps } from "gatsby";
import { CMSEditor } from "cms-editor-react";
import type { CMSDocument } from "cms-editor-core";
import { formTemplate } from "cms-editor-form";
import { FormKit, CMSForm } from "cms-editor-form/react";
const extensions = [FormKit];
import "cms-editor-core/style.css";
import "cms-editor-form/style.css";
export default function IndexPage(_: PageProps): JSX.Element {
  const [doc, setDoc] = React.useState<CMSDocument | null>(null),
    [preview, setPreview] = React.useState(false);
  React.useEffect(() => setDoc(formTemplate()), []);
  return (
    <main style={{ maxWidth: 850, margin: "40px auto", padding: 20 }}>
      <h1>Blockroom · Gatsby</h1>
      <p>Next.js와 동일한 패키지를 사용하는 Gatsby 예제입니다.</p>
      <button type="button" onClick={() => setPreview(!preview)}>
        {preview ? "편집으로" : "미리보기"}
      </button>
      {doc &&
        (preview ? (
          <CMSForm
            document={doc}
            onSubmit={(submission) => {
              localStorage.setItem(
                "cms-editor:gatsby-response",
                JSON.stringify(submission),
              );
            }}
          />
        ) : (
          <CMSEditor extensions={extensions} document={doc} onChange={setDoc} />
        ))}
    </main>
  );
}
export function Head(_: HeadProps): JSX.Element {
  return <title>Blockroom · Gatsby integration</title>;
}
