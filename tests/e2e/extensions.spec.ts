import { test, expect } from "@playwright/test";
test("consumer React blocks retain context, edit attributes, undo and submit a custom form", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/examples/custom-blocks");
  const content = page.getByLabel("콘텐츠 편집");
  await expect(content).toBeVisible();
  await expect(content.getByText("우리 서비스의 커스텀 블록")).toBeVisible();
  await expect(content.getByText("우리 서비스의 질문 컴포넌트")).toHaveCount(2);
  const title = page.getByLabel("안내 카드 제목");
  await title.fill("변경한 안내");
  await title.press("ArrowLeft");
  await page.keyboard.insertText("!");
  await expect(title).toHaveValue("변경한 안!내");
  await title.press("ControlOrMeta+z");
  await expect(title).toHaveValue("참여 안내");
  await title.fill("고객 안내");
  await page.getByLabel("커스텀 질문 제목").first().fill("담당자 이름");
  await page
    .getByRole("button", { name: "내 폼 미리보기", exact: true })
    .click();
  await expect(page.getByText("고객 안내", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "내 디자인으로 제출" }).click();
  await expect(page.getByText("필수 질문에 답해주세요.")).toBeVisible();
  await page.getByLabel("담당자 이름", { exact: true }).fill("고객");
  await page.getByLabel("이메일", { exact: true }).fill("test@example.com");
  await page.getByRole("button", { name: "내 디자인으로 제출" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "커스텀 폼 제출 완료" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "편집으로", exact: true }).click();
  await expect(title).toHaveValue("고객 안내");
  await expect(page.getByLabel("커스텀 질문 제목").first()).toHaveValue(
    "담당자 이름",
  );
  await page.screenshot({ path: "test-results/consumer-components.png" });
  await page
    .getByRole("button", { name: "1번 블록 핸들", exact: true })
    .hover();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await expect(title).toHaveCount(0);
  await page
    .getByRole("button", { name: "내 폼 미리보기", exact: true })
    .click();
  await expect(page.getByLabel("담당자 이름", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
