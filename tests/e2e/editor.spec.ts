import { test, expect, type Page } from "@playwright/test";
async function historyShortcut(page: Page, redo = false) {
  await page.getByLabel("콘텐츠 편집").focus();
  await page.keyboard.press(redo ? "ControlOrMeta+Shift+z" : "ControlOrMeta+z");
}

test("form builder persists settings and validates real responses", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.getByRole("button", { name: "사이드 패널", exact: true }).click();
  await page.getByLabel("문서 이름").fill("사용자 테스트 폼");
  await page.getByRole("button", { name: "숫자 추가", exact: true }).click();
  const question = page.locator('[data-field-kind="number"]');
  await question.getByLabel("질문 제목", { exact: true }).fill("참여 인원");
  await question.getByLabel("필수 질문", { exact: true }).check();
  await question.getByLabel("최솟값", { exact: true }).fill("1");
  await question.getByLabel("최솟값", { exact: true }).press("Tab");
  await expect(
    page.getByRole("status").filter({ hasText: "이 브라우저에 저장됨" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("문서 이름")).toHaveValue("사용자 테스트 폼");
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(page.getByText("필수 질문에 답해주세요.").first()).toBeVisible();
  await page.getByLabel("어떻게 불러드릴까요?").fill("테스터");
  await page.getByLabel("소식을 받을 이메일을 알려주세요.").fill("invalid");
  await page.getByLabel("참여 인원").fill("0");
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(page.getByText("이메일 주소를 확인하세요.")).toBeVisible();
  await expect(page.getByText("1 이상 입력하세요.")).toBeVisible();
  await page
    .getByLabel("소식을 받을 이메일을 알려주세요.")
    .fill("tester@example.com");
  await page.getByLabel("참여 인원").fill("2");
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "신청이 완료되었습니다" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("block duplication, movement, undo, and import rejection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.getByRole("button", { name: "사이드 패널", exact: true }).click();
  await page
    .getByRole("button", { name: "짧은 답변 추가", exact: true })
    .click();
  await page.getByRole("button", { name: "블록 복제", exact: true }).click();
  const count = await page.locator(".cms-atomic").count();
  expect(count).toBe(7);
  await page.getByRole("button", { name: "블록 위로", exact: true }).click();
  await page.getByRole("button", { name: "블록 삭제", exact: true }).click();
  await expect(page.locator(".cms-atomic")).toHaveCount(count - 1);
  await historyShortcut(page);
  await expect(page.locator(".cms-atomic")).toHaveCount(count);
  await page.locator("input[type=file][hidden]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });
  await expect(page.locator(".studio-error")).toContainText(
    "지원하지 않는 문서 버전",
  );
});
test("vanilla editor supports custom blocks, slash menu, and form submission", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.getByLabel("콘텐츠 편집").focus();
  await page.keyboard.press("ControlOrMeta+Shift+k");
  await page.getByLabel("블록 검색").fill("알림");
  await page.getByRole("button", { name: "알림 상자 추가" }).click();
  await expect(page.locator(".callout")).toBeVisible();
  await page.locator(".callout").click();
  await page.keyboard.type("Custom block works");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.reload();
  await expect(page.locator(".callout")).toContainText("Custom block works");
  await page.getByRole("button", { name: "응답 화면", exact: true }).click();
  await page.getByLabel("어떻게 불러드릴까요?").fill("Vanilla");
  await page
    .getByLabel("소식을 받을 이메일을 알려주세요.")
    .fill("vanilla@example.com");
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(
    page.getByText("응답이 제출되었습니다. 감사합니다."),
  ).toBeVisible();
});
for (const width of [320, 375, 414, 768, 1440])
  test(`layout fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/studio-${width}.png`,
      fullPage: true,
    });
  });

test("rich text, slash commands, image upload and draft switching", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.getByRole("button", { name: "새 문서", exact: true }).click();
  await page.getByRole("button", { name: "빈 문서", exact: true }).click();
  const content = page.getByLabel("콘텐츠 편집");
  await content.click();
  await page.keyboard.type("/");
  await expect(
    page.getByRole("dialog", { name: "블록 추가", exact: true }),
  ).toBeVisible();
  await page.keyboard.insertText("제목 2");
  await page
    .getByRole("dialog", { name: "블록 추가", exact: true })
    .getByRole("option", { name: "제목 2 추가", exact: true })
    .click();
  await page.keyboard.insertText("한글 제목");
  await expect(content.locator("h2")).toContainText("한글 제목");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.insertText("굵은 본문");
  await expect(content.locator("strong")).toContainText("굵은 본문");
  await page.getByLabel("콘텐츠 편집").focus();
  await page.keyboard.press("ControlOrMeta+Shift+k");
  await page.getByLabel("블록 검색").fill("이미지");
  await page.getByRole("button", { name: "이미지 추가", exact: true }).click();
  await page
    .locator(".cms-atomic")
    .filter({ hasText: "이미지를 선택해주세요" })
    .getByRole("button", { name: "이 블록 설정" })
    .click();
  await page.getByLabel("이미지 파일").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(content.locator("img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await page.getByLabel("대체 텍스트", { exact: true }).fill("테스트 이미지");
  await page.getByLabel("대체 텍스트", { exact: true }).press("Tab");
  await expect(content.locator("img")).toHaveAttribute("alt", "테스트 이미지");
  await expect(
    page.getByRole("status").filter({ hasText: "이 브라우저에 저장됨" }),
  ).toBeVisible();
  await page
    .getByLabel("내 문서", { exact: true })
    .selectOption({ label: "함께 만드는 작은 모임" });
  await expect(content).toContainText("새로운 만남의 시작");
  await page
    .getByLabel("내 문서", { exact: true })
    .selectOption({ label: "새로운 폼" });
  await expect(content).toContainText("한글 제목");
  await expect(content.locator("img")).toBeVisible();
});

test("submission failure preserves answers and can retry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await page.getByLabel("어떻게 불러드릴까요?").fill("Retry");
  await page
    .getByLabel("소식을 받을 이메일을 알려주세요.")
    .fill("retry@example.com");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes(":responses:")) {
        Storage.prototype.setItem = original;
        throw new Error("연결에 실패했습니다. 다시 시도해주세요.");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(
    page.getByText("연결에 실패했습니다. 다시 시도해주세요."),
  ).toBeVisible();
  await expect(page.getByLabel("어떻게 불러드릴까요?")).toHaveValue("Retry");
  await page.getByRole("button", { name: "참여 신청하기" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "신청이 완료되었습니다" }),
  ).toBeVisible();
});

for (const width of [320, 1280]) {
  test(`slash popover anchors to the cursor and restores editing at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    await page.getByRole("button", { name: "새 문서", exact: true }).click();
    await page.getByRole("button", { name: "빈 문서", exact: true }).click();
    const editor = page.getByLabel("콘텐츠 편집");
    await editor.click();
    await page.keyboard.type("/");
    const popover = page.locator(".cms-slash-popover");
    await expect(popover).toBeVisible();
    await expect(editor).toBeFocused();
    await expect(popover.getByText("추천", { exact: true })).toBeVisible();
    await expect(
      popover.getByRole("button", { name: "메뉴 닫기 esc" }),
    ).toBeVisible();
    expect(
      await popover.evaluate((node) => node.matches(":popover-open")),
    ).toBe(true);
    await expect(page.locator(":modal")).toHaveCount(0);
    const panel = await popover.boundingBox(),
      paragraph = await editor.locator("p").first().boundingBox();
    expect(panel).not.toBeNull();
    expect(paragraph).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(900);
    const belowGap = panel!.y - (paragraph!.y + paragraph!.height);
    const aboveGap = paragraph!.y - (panel!.y + panel!.height);
    expect(
      Math.min(Math.abs(belowGap - 8), Math.abs(aboveGap - 8)),
    ).toBeLessThan(8);
    await page.screenshot({ path: `test-results/slash-popover-${width}.png` });
    await page.getByLabel("문서 이름", { exact: true }).click();
    await expect(popover).toHaveCount(0);
    await expect(page.getByLabel("문서 이름", { exact: true })).toBeFocused();
    await editor.click();
    await page.keyboard.press("Backspace");
    await page.keyboard.type("/");
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(editor).toBeFocused();
    await expect(editor.locator("p")).toHaveText("/");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("/");
    await expect(popover).toBeVisible();
    await expect(popover.locator("input")).toHaveCount(0);
    await expect(editor).toBeFocused();
    await page.keyboard.insertText("제목");
    await expect(editor.locator("p")).toHaveText("/제목");
    await expect(popover.getByRole("option")).toHaveCount(3);
    await page.keyboard.press("ArrowDown");
    await expect(
      popover.getByRole("option", { name: "제목 2 추가", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(editor).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(
      popover.getByRole("option", { name: "제목 1 추가", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(popover).toHaveCount(0);
    await expect(editor).toBeFocused();
    await page.keyboard.insertText("이어서 작성");
    await expect(editor.locator("h2")).toHaveText("이어서 작성");
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 1280])
  test(`build and submit without side panels at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const content = page.getByLabel("콘텐츠 편집");
    await expect(content).toBeVisible();
    await expect(page.locator("#block-library")).toBeHidden();
    await expect(page.locator("#block-settings")).toBeHidden();
    await expect(page.getByRole("toolbar", { name: "편집 도구" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "새 문서", exact: true }).click();
    await page.getByRole("button", { name: "빈 문서", exact: true }).click();
    await content.click();
    await page.keyboard.type("/");
    await page.keyboard.insertText("하나 선택");
    await page.keyboard.press("Enter");
    const card = page.locator(".cms-atomic");
    await expect(card).toHaveCount(1);
    const settings = page.getByRole("dialog", {
      name: "블록 설정",
      exact: true,
    });
    await card.getByLabel("질문 제목", { exact: true }).fill("참여 시간");
    await card.getByLabel("필수 질문", { exact: true }).check();
    await card.getByLabel("선택지 1", { exact: true }).fill("오전");
    await card.getByLabel("선택지 2", { exact: true }).fill("오후");
    await expect(card.getByLabel("질문 제목", { exact: true })).toHaveValue(
      "참여 시간",
    );
    await expect(settings).toBeHidden();
    const actions = page.getByRole("menu", { name: "블록 작업" });
    await page
      .getByRole("button", { name: "1번 블록 핸들", exact: true })
      .hover();
    await actions.getByRole("menuitem", { name: "복제", exact: true }).click();
    await expect(card).toHaveCount(2);
    await page
      .getByRole("button", { name: "2번 블록 핸들", exact: true })
      .hover();
    await page
      .getByRole("button", { name: "2번 블록 핸들", exact: true })
      .focus();
    await page.keyboard.press("Alt+ArrowUp");
    await page
      .getByRole("button", { name: "1번 블록 핸들", exact: true })
      .hover();
    await actions.getByRole("menuitem", { name: "삭제", exact: true }).click();
    await expect(card).toHaveCount(1);
    await page
      .getByRole("button", { name: "사이드 패널", exact: true })
      .click();
    await expect(page.locator("#block-library")).toBeVisible();
    await expect(page.locator("#block-settings")).toBeVisible();
    await expect(page.getByLabel("질문 제목", { exact: true })).toHaveValue(
      "참여 시간",
    );
    await page
      .getByRole("button", { name: "사이드 패널", exact: true })
      .click();
    await expect(page.locator("#block-settings")).toBeHidden();
    await historyShortcut(page);
    await expect(card).toHaveCount(2);
    await historyShortcut(page, true);
    await expect(card).toHaveCount(1);
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ hasText: "이 브라우저에 저장됨" }),
    ).toBeAttached();
    await page.reload();
    await expect(content).toBeVisible();
    await expect(page.locator("#block-library")).toBeHidden();
    await expect(card.getByLabel("질문 제목", { exact: true })).toHaveValue(
      "참여 시간",
    );
    await page
      .getByRole("button", { name: "1번 블록 핸들", exact: true })
      .hover();
    await expect(actions).toBeVisible();
    const box = await actions.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    await page.screenshot({
      path: `test-results/panel-free-settings-${width}.png`,
    });
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(page.locator("#block-library")).toBeHidden();
    await page.getByLabel("오전", { exact: true }).check();
    await page.getByRole("button", { name: "제출하기", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "신청이 완료되었습니다" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

for (const width of [320, 1280])
  test(`edit question content directly without opening settings at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    const first = page.locator('[data-field-kind="text"]').first();
    const title = first.getByLabel("질문 제목", { exact: true });
    await title.fill("이름을 알려주세요");
    await title.press("Home");
    await page.keyboard.insertText("참여자 ");
    await expect(title).toHaveValue("참여자 이름을 알려주세요");
    await expect(title).toBeFocused();
    await first
      .getByLabel("도움말", { exact: true })
      .fill("닉네임도 괜찮아요.");
    await first
      .getByLabel("입력 안내", { exact: true })
      .fill("이름이나 닉네임");
    await first.getByLabel("필수 질문", { exact: true }).uncheck();
    const choices = page.locator('[data-field-kind="radio"]').first();
    await choices.getByLabel("선택지 1", { exact: true }).fill("대화 시간");
    await choices.getByRole("button", { name: "선택지 추가" }).click();
    await choices
      .getByLabel("선택지 4", { exact: true })
      .fill("함께 만드는 프로젝트");
    await choices
      .getByRole("button", { name: "선택지 2 삭제", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "블록 설정", exact: true }),
    ).toBeHidden();
    await expect(page.locator("#block-settings")).toBeHidden();
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ hasText: "이 브라우저에 저장됨" }),
    ).toBeAttached();
    await page.reload();
    await expect(title).toHaveValue("참여자 이름을 알려주세요");
    await expect(first.getByLabel("도움말", { exact: true })).toHaveValue(
      "닉네임도 괜찮아요.",
    );
    await expect(
      first.getByLabel("필수 질문", { exact: true }),
    ).not.toBeChecked();
    await title.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/inline-question-${width}.png`,
    });
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const preview = page.locator(".cms-form");
    await expect(
      preview.getByLabel("참여자 이름을 알려주세요", { exact: true }),
    ).toHaveAttribute("placeholder", "이름이나 닉네임");
    await expect(preview).toContainText("닉네임도 괜찮아요.");
    await expect(
      preview.getByLabel("함께 만드는 프로젝트", { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByLabel("대화 시간", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

for (const width of [320, 1280]) {
  test(`submit label and alignment edit inline and persist at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const card = page.locator(".cms-submit-editor");
    const input = card.getByRole("textbox", { name: "버튼 문구" });
    await expect(input).toHaveValue("참여 신청하기");
    await expect(card.getByRole("button", { name: /설정/ })).toHaveCount(0);
    await input.fill("신청 완료하기");
    for (let i = 0; i < 6; i++) await input.press("ArrowLeft");
    await page.keyboard.insertText("규 ");
    await expect(input).toHaveValue("신규 청 완료하기");
    await input.fill("지금 신청하기");
    await card
      .getByRole("button", { name: "가운데 정렬", exact: true })
      .click();
    await expect(card.locator(".cms-submit-row")).toHaveCSS(
      "text-align",
      "center",
    );
    const row = await card.locator(".cms-submit-row").boundingBox();
    const label = await card.locator(".cms-submit-label").boundingBox();
    expect(
      Math.abs(label!.x + label!.width / 2 - row!.x - row!.width / 2),
    ).toBeLessThan(1);
    await card
      .getByRole("button", { name: "오른쪽 정렬", exact: true })
      .click();
    await historyShortcut(page);
    await expect(card.locator(".cms-submit-row")).toHaveCSS(
      "text-align",
      "center",
    );
    await historyShortcut(page, true);
    await expect(card.locator(".cms-submit-row")).toHaveCSS(
      "text-align",
      "right",
    );
    await input.fill(
      "아주 긴 버튼 문구를 입력해도 화면 너비를 넘어가지 않습니다",
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await input.fill("지금 신청하기");
    await input.press("Tab");
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ hasText: "이 브라우저에 저장됨" }),
    ).toBeAttached();
    await page.reload();
    await expect(input).toHaveValue("지금 신청하기");
    await expect(
      card.getByRole("button", { name: "오른쪽 정렬", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/submit-inline-${width}.png` });
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const submit = page.getByRole("button", {
      name: "지금 신청하기",
      exact: true,
    });
    await expect(submit).toBeVisible();
    await expect(submit.locator("..")).toHaveCSS("text-align", "right");
    await submit.click();
    await expect(
      page.getByText("필수 질문에 답해주세요.").first(),
    ).toBeVisible();
  });
}
