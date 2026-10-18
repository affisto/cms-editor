import {
  createDocument,
  newId,
  textBlock,
  type CMSDocument,
  type JSONNode,
} from "cms-editor-core";
import type { FieldKind } from "./schema";
export function fieldBlock(
  kind: FieldKind = "text",
  label = "새 질문",
  attrs: Record<string, unknown> = {},
): JSONNode {
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
      options: ["첫 번째 선택지", "두 번째 선택지"],
      min: null,
      max: null,
      ...attrs,
    },
  };
}
export function formTemplate(): CMSDocument {
  return createDocument("함께 만드는 작은 모임", [
    textBlock("새로운 만남의 시작", "heading", { level: 1 }),
    textBlock(
      "관심사를 나누고 함께 배우는 시간을 준비하고 있어요. 아래 질문에 답해주시면 모임 소식을 전해드릴게요.",
    ),
    { type: "divider", attrs: { id: newId() } },
    fieldBlock("text", "어떻게 불러드릴까요?", {
      required: true,
      placeholder: "이름 또는 닉네임",
    }),
    fieldBlock("email", "소식을 받을 이메일을 알려주세요.", {
      required: true,
      placeholder: "hello@example.com",
      help: "모임 안내를 보내드리는 용도로만 사용해요.",
    }),
    fieldBlock("radio", "어떤 시간이 가장 기대되나요?", {
      options: [
        "새로운 사람들과의 대화",
        "함께 배우는 워크숍",
        "각자의 작업을 소개하는 시간",
      ],
    }),
    fieldBlock("textarea", "미리 전하고 싶은 이야기가 있나요?", {
      placeholder: "편하게 남겨주세요.",
    }),
    { type: "submit", attrs: { id: newId(), label: "참여 신청하기" } },
  ]);
}
