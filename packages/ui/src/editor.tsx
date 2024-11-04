// The Gatsby build needs this import.
// eslint-disable-next-line no-redeclare
import * as React from "react";
import { schema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

const uid = "editor";

export function Editor(): JSX.Element {
    const mounted = React.useRef(false);
    
    React.useEffect(() => {
        
    });
  
let view = new EditorView(document.body, { state });
  let state = EditorState.create({ schema });
  return <div id={uid}>Boop</div>;
}
