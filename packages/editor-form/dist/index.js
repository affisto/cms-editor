import {
  FormField,
  FormKit,
  SubmitButton,
  collectFields,
  createSubmission,
  fieldKinds,
  validateAnswers,
  validateFieldAttributes
} from "./chunk-ZE57S57O.js";

// src/templates.ts
import {
  createDocument,
  newId,
  textBlock
} from "cms-editor-core";
function fieldBlock(kind = "text", label = "\uC0C8 \uC9C8\uBB38", attrs = {}) {
  return {
    type: "field",
    attrs: {
      id: newId(),
      fieldId: newId(),
      kind,
      label,
      help: "",
      required: false,
      placeholder: "",
      options: ["\uCCAB \uBC88\uC9F8 \uC120\uD0DD\uC9C0", "\uB450 \uBC88\uC9F8 \uC120\uD0DD\uC9C0"],
      min: null,
      max: null,
      ...attrs
    }
  };
}
function formTemplate() {
  return createDocument("\uD568\uAED8 \uB9CC\uB4DC\uB294 \uC791\uC740 \uBAA8\uC784", [
    textBlock("\uC0C8\uB85C\uC6B4 \uB9CC\uB0A8\uC758 \uC2DC\uC791", "heading", { level: 1 }),
    textBlock(
      "\uAD00\uC2EC\uC0AC\uB97C \uB098\uB204\uACE0 \uD568\uAED8 \uBC30\uC6B0\uB294 \uC2DC\uAC04\uC744 \uC900\uBE44\uD558\uACE0 \uC788\uC5B4\uC694. \uC544\uB798 \uC9C8\uBB38\uC5D0 \uB2F5\uD574\uC8FC\uC2DC\uBA74 \uBAA8\uC784 \uC18C\uC2DD\uC744 \uC804\uD574\uB4DC\uB9B4\uAC8C\uC694."
    ),
    { type: "divider", attrs: { id: newId() } },
    fieldBlock("text", "\uC5B4\uB5BB\uAC8C \uBD88\uB7EC\uB4DC\uB9B4\uAE4C\uC694?", {
      required: true,
      placeholder: "\uC774\uB984 \uB610\uB294 \uB2C9\uB124\uC784"
    }),
    fieldBlock("email", "\uC18C\uC2DD\uC744 \uBC1B\uC744 \uC774\uBA54\uC77C\uC744 \uC54C\uB824\uC8FC\uC138\uC694.", {
      required: true,
      placeholder: "hello@example.com",
      help: "\uBAA8\uC784 \uC548\uB0B4\uB97C \uBCF4\uB0B4\uB4DC\uB9AC\uB294 \uC6A9\uB3C4\uB85C\uB9CC \uC0AC\uC6A9\uD574\uC694."
    }),
    fieldBlock("radio", "\uC5B4\uB5A4 \uC2DC\uAC04\uC774 \uAC00\uC7A5 \uAE30\uB300\uB418\uB098\uC694?", {
      options: [
        "\uC0C8\uB85C\uC6B4 \uC0AC\uB78C\uB4E4\uACFC\uC758 \uB300\uD654",
        "\uD568\uAED8 \uBC30\uC6B0\uB294 \uC6CC\uD06C\uC20D",
        "\uAC01\uC790\uC758 \uC791\uC5C5\uC744 \uC18C\uAC1C\uD558\uB294 \uC2DC\uAC04"
      ]
    }),
    fieldBlock("textarea", "\uBBF8\uB9AC \uC804\uD558\uACE0 \uC2F6\uC740 \uC774\uC57C\uAE30\uAC00 \uC788\uB098\uC694?", {
      placeholder: "\uD3B8\uD558\uAC8C \uB0A8\uACA8\uC8FC\uC138\uC694."
    }),
    { type: "submit", attrs: { id: newId(), label: "\uCC38\uC5EC \uC2E0\uCCAD\uD558\uAE30" } }
  ]);
}
export {
  FormField,
  FormKit,
  SubmitButton,
  collectFields,
  createSubmission,
  fieldBlock,
  fieldKinds,
  formTemplate,
  validateAnswers,
  validateFieldAttributes
};
