import { fieldBlock } from "../../packages/editor-form/src/index";
import { test, expect, type Page } from "@playwright/test";
async function historyShortcut(page: Page, redo = false) {
  await page.getByLabel("콘텐츠 편집").focus();
  await page.keyboard.press(redo ? "ControlOrMeta+Shift+z" : "ControlOrMeta+z");
}

import {
  createDocument,
  textBlock,
  newId,
  type CMSDocument,
} from "../../packages/editor-core/src/index";
const handle = (page: Page, index: number) =>
  page.getByRole("button", { name: `${index + 1}번 블록 핸들`, exact: true });
const menu = (page: Page) =>
  page.getByRole("menu", { name: "블록 작업", exact: true });
async function load(page: Page, document: CMSDocument) {
  await page.goto("/");
  await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
  await page.locator("input[type=file][hidden]").setInputFiles({
    name: "handles.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(page.getByLabel("문서 이름")).toHaveValue(document.title);
  await expect(page.locator(".cms-block-handle")).toHaveCount(
    document.content.content!.length,
  );
}
const order = (page: Page) =>
  page
    .locator(".cms-block-handle")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.blockId),
    );
const simple = () =>
  createDocument(
    "핸들 테스트",
    ["첫 번째", "두 번째", "세 번째", "네 번째"].map((value) =>
      textBlock(value),
    ),
  );
async function point(page: Page, index: number) {
  const box = await handle(page, index).boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test("desktop grip hover menu targets the hovered block and supports keyboard selection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 1100 });
  const doc = createDocument("혼합 블록", [
    textBlock("제목", "heading", { level: 2 }),
    fieldBlock("email", "연락처"),
    textBlock("본문"),
    {
      type: "toggle",
      attrs: { id: newId(), title: "참고" },
      content: [textBlock("접힌 내용")],
    },
  ]);
  await load(page, doc);
  await expect(handle(page, 1).locator("circle")).toHaveCount(6);
  await handle(page, 1).hover();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitem")).toHaveCount(2);
  await expect(menu(page).getByRole("menuitem", { name: /이동/ })).toHaveCount(
    0,
  );
  expect(await menu(page).textContent()).toBe("");
  const gripBounds = await handle(page, 1).boundingBox(),
    blockBounds = await page.locator(".cms-field-editor").boundingBox();
  expect(Math.abs(gripBounds!.y - blockBounds!.y)).toBeLessThan(1);
  const menuBounds = await menu(page).boundingBox();
  expect(menuBounds!.y + menuBounds!.height).toBeLessThan(gripBounds!.y);
  const copy = menu(page).getByRole("menuitem", { name: "복제", exact: true }),
    remove = menu(page).getByRole("menuitem", { name: "삭제", exact: true });
  const copyBounds = await copy.boundingBox(),
    removeBounds = await remove.boundingBox();
  expect(Math.abs(copyBounds!.y - removeBounds!.y)).toBeLessThan(1);
  expect(removeBounds!.x).toBeGreaterThan(copyBounds!.x);
  await copy.hover();
  await expect(page.getByRole("tooltip")).toHaveText("복제");
  const tipBounds = await page.getByRole("tooltip").boundingBox();
  expect(tipBounds!.y + tipBounds!.height).toBeLessThan(copyBounds!.y);
  await page.screenshot({ path: "test-results/block-handle-menu-desktop.png" });
  await menu(page).getByRole("menuitem", { name: "복제", exact: true }).click();
  await expect(page.locator(".cms-field-editor")).toHaveCount(2);
  const ids = await order(page);
  expect(ids[1]).toBe(doc.content.content![1].attrs!.id);
  expect(ids[2]).not.toBe(ids[1]);
  await handle(page, 2).hover();
  await menu(page).getByRole("menuitem", { name: "삭제", exact: true }).click();
  await expect(page.locator(".cms-field-editor")).toHaveCount(1);
  await handle(page, 0).focus();
  await page.keyboard.press("Enter");
  await expect(
    menu(page).getByRole("menuitem", { name: "복제" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    menu(page).getByRole("menuitem", { name: "삭제" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(handle(page, 0)).toBeFocused();
  await expect(handle(page, 0)).toHaveCSS("outline-style", "none");
  await expect(handle(page, 0)).toHaveCSS("border-top-width", "0px");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("drag reorders mixed blocks once, preserves IDs, supports undo and cancels safely", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 1100 });
  const doc = createDocument("드래그 테스트", [
    textBlock("제목", "heading", { level: 2 }),
    fieldBlock("text", "질문"),
    textBlock("본문"),
    textBlock("마지막"),
  ]);
  await load(page, doc);
  const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
    start = await point(page, 0),
    target = await page
      .getByLabel("콘텐츠 편집")
      .locator(":scope > *")
      .nth(2)
      .boundingBox();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, target!.y + target!.height + 7, { steps: 12 });
  await expect(page.locator(".cms-block-drop-line")).toBeVisible();
  await expect(page.locator(".cms-drag-preview")).toBeVisible();
  await page.screenshot({ path: "test-results/block-drag-desktop.png" });
  await page.mouse.up();
  const moved = [ids[1], ids[2], ids[0], ids[3]];
  await expect.poll(() => order(page)).toEqual(moved);
  await expect(page.locator(".cms-drag-preview")).toHaveCount(0);
  await historyShortcut(page);
  await expect.poll(() => order(page)).toEqual(ids);
  await historyShortcut(page, true);
  await expect.poll(() => order(page)).toEqual(moved);
  const again = await point(page, 0),
    last = await page
      .getByLabel("콘텐츠 편집")
      .locator(":scope > *")
      .last()
      .boundingBox();
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x, last!.y + last!.height + 5, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(moved);
  await expect(page.locator(".save-state")).toHaveText("이 브라우저에 저장됨");
  await page.reload();
  await expect.poll(() => order(page)).toEqual(moved);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cms-editor:document:v1")!),
  );
  expect(stored.content.content[0].attrs.fieldId).toBe(
    doc.content.content![1].attrs!.fieldId,
  );
  expect(errors).toEqual([]);
});

test("drag scrolls a long document at the viewport edge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  const doc = createDocument(
    "긴 문서",
    Array.from({ length: 28 }, (_, i) => textBlock(`문단 ${i + 1}`)),
  );
  await load(page, doc);
  const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
    start = await point(page, 0),
    before = await page.evaluate(() => scrollY);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, 690, { steps: 8 });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(before + 150);
  await page.mouse.up();
  const moved = await order(page);
  expect(moved[0]).not.toBe(ids[0]);
  expect(new Set(moved)).toEqual(new Set(ids));
  await historyShortcut(page);
  await expect.poll(() => order(page)).toEqual(ids);
});

test.describe("touch grip interactions", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("long press opens the menu and a tap runs its action", async ({
    page,
  }) => {
    const doc = simple();
    await load(page, doc);
    const start = await point(page, 1),
      client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await expect(menu(page)).toBeVisible();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const rect = await menu(page).boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "test-results/block-handle-menu-touch.png" });
    await menu(page).getByRole("menuitem", { name: "복제", exact: true }).tap();
    await expect(page.locator(".cms-block-handle")).toHaveCount(5);
    expect((await order(page))[1]).toBe(doc.content.content![1].attrs!.id);
    await client.detach();
  });
  test("moving the touch reorders without opening the long-press menu", async ({
    page,
  }) => {
    const doc = simple();
    await load(page, doc);
    const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
      start = await point(page, 0),
      last = await page
        .getByLabel("콘텐츠 편집")
        .locator(":scope > *")
        .last()
        .boundingBox(),
      client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x, y: last!.y + last!.height + 6, id: 1 }],
    });
    await expect(page.locator(".cms-drag-preview")).toBeVisible();
    await expect(menu(page)).toBeHidden();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => order(page)).toEqual([...ids.slice(1), ids[0]]);
    await client.detach();
  });
  test("touch cancellation leaves the document and editing usable", async ({
    page,
  }) => {
    const doc = simple();
    await load(page, doc);
    const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
      start = await point(page, 0),
      client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x, y: start.y + 100, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect.poll(() => order(page)).toEqual(ids);
    await expect(page.locator(".cms-drag-preview")).toHaveCount(0);
    await expect(menu(page)).toBeHidden();
    await page.getByLabel("콘텐츠 편집").locator("p").first().tap();
    await page.keyboard.insertText("편집");
    await expect(page.getByLabel("콘텐츠 편집")).toContainText("편집");
    await client.detach();
  });
});

test("drag shows a full block preview, moves neighbours smoothly and clears animations on drop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 1100 });
  const doc = createDocument("드래그 애니메이션", [
    fieldBlock("text", "이동할 질문"),
    textBlock("두 번째"),
    textBlock("세 번째"),
  ]);
  await load(page, doc);
  const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
    start = await point(page, 0),
    content = page.getByLabel("콘텐츠 편집"),
    last = await content.locator(":scope > *").last().boundingBox();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, last!.y + last!.height + 6, { steps: 12 });
  const preview = page.locator(".cms-drag-preview");
  await expect(preview).toBeVisible();
  await expect(preview.locator('[aria-label="질문 제목"]')).toHaveValue(
    "이동할 질문",
  );
  await expect
    .poll(() =>
      content
        .locator(":scope > *")
        .nth(1)
        .evaluate((node) => getComputedStyle(node).translate),
    )
    .not.toBe("none");
  expect(await order(page)).toEqual(ids);
  await expect(content.locator(".cms-field-editor")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: "test-results/block-drag-motion.png" });
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual([ids[1], ids[2], ids[0]]);
  await expect
    .poll(() =>
      page
        .locator(".cms-surface")
        .evaluate(
          (node) =>
            node
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
    )
    .toBe(0);
  await expect(preview).toHaveCount(0);
  await expect(content.locator(".cms-field-editor")).toHaveCSS("opacity", "1");
  const title = content.getByLabel("질문 제목", { exact: true });
  await title.fill("이동 후 수정");
  await expect(title).toHaveValue("이동 후 수정");
  expect(errors).toEqual([]);
});

test("reduced motion retains drag ordering without running motion effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  const doc = simple();
  await load(page, doc);
  const ids = doc.content.content!.map((n) => String(n.attrs!.id)),
    start = await point(page, 0),
    last = await page
      .getByLabel("콘텐츠 편집")
      .locator(":scope > *")
      .last()
      .boundingBox();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, last!.y + last!.height + 6, { steps: 8 });
  await expect(page.locator(".cms-drag-preview")).toBeVisible();
  expect(
    await page
      .locator(".cms-surface")
      .evaluate(
        (node) =>
          node
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
  ).toBe(0);
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual([...ids.slice(1), ids[0]]);
  await expect(page.locator(".cms-drag-preview")).toHaveCount(0);
  expect(
    await page
      .locator(".cms-surface")
      .evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

for (const type of ["bullet_list", "ordered_list"]) {
  test(`${type} item grips reorder, cancel, undo and preserve nested content`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    const item = (id: string, value: string) => ({
      type: "list_item",
      attrs: { id },
      content: [textBlock(value)],
    });
    const first = item("list-a", "리스트 하나");
    first.content.push({
      type: "bullet_list",
      attrs: { id: "nested-list" },
      content: [item("nested-item", "중첩 내용")],
    });
    const doc = createDocument("목록 이동", [
      textBlock("안녕"),
      {
        type,
        attrs: { id: "list", ...(type === "ordered_list" ? { order: 3 } : {}) },
        content: [
          first,
          item("list-b", "리스트 둘"),
          item("list-c", "리스트 셋"),
        ],
      },
      textBlock("마지막 문단"),
    ]);
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    await page.locator("input[type=file][hidden]").setInputFiles({
      name: "list.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(doc)),
    });
    const root = page.getByLabel("콘텐츠 편집");
    const list = root.locator(
      type === "bullet_list" ? ":scope > ul" : ":scope > ol",
    );
    const items = list.locator(":scope > li > p");
    const grip = (id: string) =>
      page.locator(`.cms-block-handle[data-block-id="${id}"]`);
    await expect(grip("list")).toBeHidden();
    await expect(grip("list-a")).toBeVisible();
    await expect(grip("list-b")).toBeVisible();
    await expect(grip("list-c")).toBeVisible();
    await expect(grip("nested-item")).toBeVisible();
    const start = await grip("list-a").boundingBox();
    const target = await list.locator(":scope > li").last().boundingBox();
    await page.mouse.move(start!.x + 14, start!.y + 14);
    await page.mouse.down();
    await page.mouse.move(start!.x + 14, target!.y + target!.height + 3, {
      steps: 10,
    });
    await expect(page.locator(".cms-drag-preview")).toContainText("중첩 내용");
    await page.mouse.up();
    await expect(items).toHaveText(["리스트 둘", "리스트 셋", "리스트 하나"]);
    await expect(list.locator(":scope > li").last()).toContainText("중첩 내용");
    await expect(root.locator(":scope > p")).toHaveText([
      "안녕",
      "마지막 문단",
    ]);
    if (type === "ordered_list")
      await expect(list).toHaveAttribute("start", "3");
    await historyShortcut(page);
    await expect(items).toHaveText(["리스트 하나", "리스트 둘", "리스트 셋"]);
    await grip("list-b").focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(items).toHaveText(["리스트 둘", "리스트 하나", "리스트 셋"]);
    await grip("list-b").hover();
    await menu(page)
      .getByRole("menuitem", { name: "복제", exact: true })
      .click();
    await expect(items).toHaveText([
      "리스트 둘",
      "리스트 둘",
      "리스트 하나",
      "리스트 셋",
    ]);
    await grip("list-b").hover();
    await menu(page)
      .getByRole("menuitem", { name: "삭제", exact: true })
      .click();
    await expect(items).toHaveText(["리스트 둘", "리스트 하나", "리스트 셋"]);
    await expect(grip("list-b")).toHaveCount(0);
    const cancelStart = await grip("list-c").boundingBox();
    const cancelTarget = await list
      .locator(":scope > li")
      .first()
      .boundingBox();
    await page.mouse.move(cancelStart!.x + 14, cancelStart!.y + 14);
    await page.mouse.down();
    await page.mouse.move(cancelStart!.x + 14, cancelTarget!.y - 5, {
      steps: 10,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(items).toHaveText(["리스트 둘", "리스트 하나", "리스트 셋"]);
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ hasText: "이 브라우저에 저장됨" }),
    ).toBeAttached();
    await page.reload();
    await expect(items).toHaveText(["리스트 둘", "리스트 하나", "리스트 셋"]);
    await page.screenshot({ path: `test-results/${type}-handles.png` });
  });
}

test.describe("touch list item handles", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("touch dragging reorders individual list items", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    const doc = createDocument("모바일 목록", [
      {
        type: "ordered_list",
        attrs: { id: "mobile-list", order: 1 },
        content: ["첫째", "둘째", "셋째"].map((value, i) => ({
          type: "list_item",
          attrs: { id: `mobile-${i}` },
          content: [textBlock(value)],
        })),
      },
    ]);
    await page.locator("input[type=file][hidden]").setInputFiles({
      name: "mobile-list.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(doc)),
    });
    const grip = page.locator('.cms-block-handle[data-block-id="mobile-0"]');
    await grip.scrollIntoViewIfNeeded();
    const start = await grip.boundingBox();
    const last = await page
      .getByLabel("콘텐츠 편집")
      .locator("ol > li")
      .last()
      .boundingBox();
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start!.x + 14, y: start!.y + 14, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start!.x + 14, y: last!.y + last!.height + 5, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.getByLabel("콘텐츠 편집").locator("ol > li > p"),
    ).toHaveText(["둘째", "셋째", "첫째"]);
    await expect
      .poll(() =>
        page
          .locator(".cms-handle-surface")
          .evaluate(
            (root) =>
              root
                .getAnimations({ subtree: true })
                .filter((animation) => animation.playState === "running")
                .length,
          ),
      )
      .toBe(0);
    await page.screenshot({ path: "test-results/list-handles-touch.png" });
    await client.detach();
  });
});

for (const type of ["bullet_list", "ordered_list"]) {
  test(`${type} Tab and Shift+Tab work from text and item handles`, async ({
    page,
  }) => {
    const doc = createDocument("목록 들여쓰기", [
      {
        type,
        attrs: {
          id: "indent-list",
          ...(type === "ordered_list" ? { order: 4 } : {}),
        },
        content: ["첫 번째", "두 번째", "세 번째"].map((text, index) => ({
          type: "list_item",
          attrs: { id: `indent-${index}` },
          content: [textBlock(text)],
        })),
      },
      textBlock("목록 밖"),
    ]);
    await page.goto("/");
    await expect(page.getByLabel("콘텐츠 편집")).toBeVisible();
    await page.locator("input[type=file][hidden]").setInputFiles({
      name: "indent.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(doc)),
    });
    const root = page.getByLabel("콘텐츠 편집");
    const tag = type === "bullet_list" ? "ul" : "ol";
    const list = root.locator(`:scope > ${tag}`);
    const nested = list.locator(`:scope > li > ${tag}`);
    const grip = (index: number) =>
      page.locator(`.cms-block-handle[data-block-id="indent-${index}"]`);
    await list.locator(":scope > li > p").first().click();
    await page.keyboard.press("Tab");
    await expect(root).toBeFocused();
    await expect(nested).toHaveCount(0);
    await list.locator(":scope > li > p").nth(1).click();
    await page.keyboard.press("Tab");
    await expect(nested.locator(":scope > li > p")).toHaveText(["두 번째"]);
    await expect(root).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(nested).toHaveCount(0);
    await expect(list.locator(":scope > li > p")).toHaveText([
      "첫 번째",
      "두 번째",
      "세 번째",
    ]);
    await grip(1).focus();
    await page.keyboard.press("Tab");
    await expect(nested.locator(":scope > li > p")).toHaveText(["두 번째"]);
    await expect(grip(1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(nested).toHaveCount(0);
    await expect(grip(1)).toBeFocused();
    await historyShortcut(page);
    await expect(nested.locator(":scope > li > p")).toHaveText(["두 번째"]);
    await grip(2).focus();
    await page.keyboard.press("Tab");
    await expect(nested.locator(":scope > li > p")).toHaveText([
      "두 번째",
      "세 번째",
    ]);
    await page.keyboard.press("Tab");
    await expect(nested.locator(`:scope > li > ${tag} > li > p`)).toHaveText([
      "세 번째",
    ]);
    await expect(grip(2)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(nested.locator(":scope > li > p")).toHaveText([
      "두 번째",
      "세 번째",
    ]);
    if (type === "ordered_list")
      await expect(list).toHaveAttribute("start", "4");
    await expect(
      page
        .getByRole("status", { includeHidden: true })
        .filter({ hasText: "이 브라우저에 저장됨" }),
    ).toBeAttached();
    await page.reload();
    await expect(nested.locator(":scope > li > p")).toHaveText([
      "두 번째",
      "세 번째",
    ]);
    await expect(grip(1)).toBeVisible();
    await expect(grip(2)).toBeVisible();
  });
}
