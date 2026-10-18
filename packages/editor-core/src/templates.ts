import { createDocument, newId, textBlock, type CMSDocument } from "./document";
export function documentTemplate(): CMSDocument {
  return createDocument("우리 팀의 작업 노트", [
    textBlock("생각을 모으는 공간", "heading", { level: 1 }),
    textBlock(
      "문서를 쓰다가 질문을 추가하면 폼이 됩니다. / 를 입력하거나 블록 추가 버튼으로 시작해보세요.",
    ),
    textBlock("이번 주에 할 일", "heading", { level: 2 }),
    {
      type: "checklist",
      attrs: { id: newId() },
      content: [
        {
          type: "check_item",
          attrs: { id: newId(), checked: false },
          content: [textBlock("새로운 아이디어 정리하기")],
        },
        {
          type: "check_item",
          attrs: { id: newId(), checked: true },
          content: [textBlock("지난주 피드백 돌아보기")],
        },
      ],
    },
    {
      type: "blockquote",
      attrs: { id: newId() },
      content: [textBlock("작은 생각도 기록하면 다음 작업의 시작이 됩니다.")],
    },
    {
      type: "toggle",
      attrs: { id: newId(), title: "참고할 내용" },
      content: [textBlock("접었다 펼칠 수 있는 내용입니다.")],
    },
  ]);
}
