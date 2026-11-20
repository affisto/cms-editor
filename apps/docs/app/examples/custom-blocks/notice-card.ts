import type { BlockExtension } from "cms-editor-core";

export const NoticeCard: BlockExtension = {
  name: "notice_card",
  label: "안내 카드",
  spec: {
    atom: true,
    draggable: true,
    attrs: {
      title: { default: "참여 안내" },
      message: { default: "궁금한 점을 알려주세요." },
    },
    toDOM: (node) => [
      "aside",
      {
        class: "consumer-notice",
        "data-notice-card": "",
        "data-title": node.attrs.title,
        "data-message": node.attrs.message,
      },
      ["strong", node.attrs.title],
      ["p", node.attrs.message],
    ],
    parseDOM: [
      {
        tag: "aside[data-notice-card]",
        getAttrs: (dom) => ({
          title: dom.getAttribute("data-title"),
          message: dom.getAttribute("data-message"),
        }),
      },
    ],
  },
  validate(attrs) {
    if (
      typeof attrs.title !== "string" ||
      !attrs.title.trim() ||
      typeof attrs.message !== "string"
    )
      throw new Error("안내 제목과 내용을 입력하세요.");
  },
  menu: [{ label: "안내 카드", icon: "i" }],
};
