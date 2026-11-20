import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const studio = "http://127.0.0.1:4310/";
const viewport = { width: 1440, height: 1000 };
const output = fileURLToPath(new URL("../docs/media/", import.meta.url));
const demo = {
  title: "디자인 워크숍 신청",
  heading: "함께 만드는 디자인 워크숍",
  nameQuestion: "참가자 이름",
  countQuestion: "참여 인원",
  name: "김하늘",
  email: "demo@example.com",
};

async function record(directory) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      locale: "ko-KR",
      viewport,
      recordVideo: { dir: directory, size: viewport },
    });
    try {
      const page = await context.newPage();
      const video = page.video();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const button = (name) => page.getByRole("button", { name, exact: true });
      const label = (name, parent = page) =>
        parent.getByLabel(name, { exact: true });
      const editor = label("콘텐츠 편집");
      const title = label("문서 이름");
      const heading = editor.locator("h1");

      async function click(target, options = {}) {
        const inView = await target.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight;
        });
        if (!inView) {
          await target.evaluate((element) =>
            element.scrollIntoView({ block: "center", behavior: "smooth" }),
          );
          await pause(650);
        }
        const bounds = await target.boundingBox();
        const position = options.position ?? {
          x: bounds.width / 2,
          y: bounds.height / 2,
        };
        await page.mouse.move(bounds.x + position.x, bounds.y + position.y, {
          steps: 16,
        });
        await pause(200);
        await target.click({ ...options, position });
      }

      async function typeText(text) {
        for (const character of text) {
          await page.keyboard.insertText(character);
          await pause(85);
        }
      }

      async function replaceText(target, text) {
        await click(target, { position: { x: 32, y: 12 } });
        await page.keyboard.press("ControlOrMeta+a");
        await pause(260);
        await typeText(text);
        await expect(target).toHaveValue(text);
      }

      await page.goto(studio);
      await expect(editor).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveValue("함께 만드는 작은 모임");
      await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
      await page.evaluate(() => {
        const cursor = document.createElement("div");
        cursor.setAttribute("aria-hidden", "true");
        cursor.style.cssText = [
          "position: fixed",
          "top: 0",
          "left: 0",
          "width: 16px",
          "height: 16px",
          "border: 2px solid #2859d8",
          "border-radius: 50%",
          "background: rgb(40 89 216 / 15%)",
          "box-shadow: 0 0 0 2px white",
          "pointer-events: none",
          "z-index: 2147483647",
          "opacity: 0",
        ].join(";");
        document.body.append(cursor);
        window.addEventListener("pointermove", ({ clientX, clientY }) => {
          cursor.style.transform = `translate(${clientX - 8}px, ${clientY - 8}px)`;
          cursor.style.opacity = "1";
        });
        window.addEventListener("pointerdown", () => {
          cursor.animate(
            [
              { scale: "0.8", backgroundColor: "rgb(40 89 216 / 65%)" },
              { scale: "1.45", backgroundColor: "rgb(40 89 216 / 15%)" },
              { scale: "1", backgroundColor: "rgb(40 89 216 / 15%)" },
            ],
            { duration: 320 },
          );
        });
      });

      await pause(1500);
      await replaceText(title, demo.title);
      await pause(1000);
      await click(heading, { clickCount: 3, position: { x: 80, y: 20 } });
      await pause(300);
      await typeText(demo.heading);
      await expect(heading).toHaveText(demo.heading);
      await pause(1000);
      await replaceText(
        label("질문 제목", editor.locator('[data-field-kind="text"]')),
        demo.nameQuestion,
      );
      await pause(1200);

      await click(button("사이드 패널"));
      await pause(1400);
      await click(button("숫자 추가"));
      const countField = editor.locator('[data-field-kind="number"]');
      await expect(countField).toBeVisible();
      await pause(1200);
      await replaceText(label("질문 제목", countField), demo.countQuestion);
      await pause(650);
      const required = label("필수 질문", countField);
      await click(required);
      await expect(required).toBeChecked();
      await pause(650);
      const minimum = label("최솟값", countField);
      await click(minimum);
      await typeText("1");
      await expect(minimum).toHaveValue("1");
      await expect(
        page.getByRole("status").filter({ hasText: "이 브라우저에 저장됨" }),
      ).toBeVisible();
      await pause(1200);
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "smooth" }),
      );
      await pause(500);
      await page.screenshot({ path: join(directory, "cms-editor-demo.png") });

      await click(button("미리보기"));
      await expect(
        page.getByRole("heading", { name: demo.heading }),
      ).toBeVisible();
      await pause(2100);
      const submit = button("참여 신청하기");
      await click(submit);
      const requiredError = page.getByText("필수 질문에 답해주세요.");
      await expect(requiredError).toHaveCount(3);
      await expect(requiredError.first()).toBeInViewport();
      await pause(2700);

      await click(page.getByLabel(demo.nameQuestion), {
        position: { x: 36, y: 18 },
      });
      await typeText(demo.name);
      await pause(550);
      await click(page.getByLabel(demo.countQuestion), {
        position: { x: 36, y: 18 },
      });
      await typeText("2");
      await pause(550);
      await click(page.getByLabel("소식을 받을 이메일을 알려주세요."), {
        position: { x: 92, y: 18 },
      });
      await typeText(demo.email);
      await pause(650);
      await click(page.getByRole("radio", { name: "함께 배우는 워크숍" }));
      await pause(1000);
      await click(submit);
      const success = page
        .getByRole("status")
        .filter({ hasText: "신청이 완료되었습니다." });
      await expect(success).toBeVisible();
      await success.scrollIntoViewIfNeeded();
      await pause(4200);

      expect(errors).toEqual([]);
      return await video.path();
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function ffmpeg(args) {
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    {
      stdio: "inherit",
    },
  );
}

const response = await fetch(studio, {
  redirect: "error",
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) {
  throw new Error(`Studio at ${studio} returned HTTP ${response.status}.`);
}
await response.text();
execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });

const directory = await mkdtemp(join(tmpdir(), "cms-editor-demo-"));
try {
  const recording = await record(directory);
  const mp4 = join(directory, "cms-editor-demo.mp4");
  const gif = join(directory, "cms-editor-demo.gif");
  ffmpeg([
    "-ss",
    "0.4",
    "-i",
    recording,
    "-c:v",
    "libx264",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    mp4,
  ]);
  ffmpeg([
    "-i",
    mp4,
    "-filter_complex",
    "[0:v]fps=8,scale=1080:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
    "-loop",
    "0",
    gif,
  ]);
  await mkdir(output, { recursive: true });
  for (const extension of ["mp4", "gif", "png"]) {
    const filename = `cms-editor-demo.${extension}`;
    await copyFile(join(directory, filename), join(output, filename));
  }
  console.log(
    "Recorded editor, validation, and successful submission in docs/media/.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
