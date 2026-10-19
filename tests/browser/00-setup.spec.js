import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
test("secure setup, invitation, uploads, joint carousel approval and export in two browsers", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const state = await (await request.get("/api/auth/state")).json();
  test.skip(!state.setup, "This test requires a fresh isolated deployment.");
  const composeProject = process.env.COMPOSE_PROJECT_NAME
    ? ["-p", process.env.COMPOSE_PROJECT_NAME]
    : [];
  const token = execFileSync(
    "docker",
    ["compose", ...composeProject, "exec", "-T", "api", "node", "scripts/admin.js", "setup-token"],
    { encoding: "utf8" },
  ).trim();
  await page.goto("/");
  await page.getByLabel("Setup token", { exact: true }).fill(token);
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByLabel("Email", { exact: true }).fill("owner@ours.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ours-integration-password-2026");
  await page
    .getByRole("button", { name: "Create our home", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-empty-home.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Account settings" }).click();
  await page
    .getByRole("button", { name: "Create invitation for my person" })
    .click();
  const invite = await page
    .getByLabel("Private invitation · valid for 48 hours")
    .inputValue();
  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await partner.goto(invite);
  await partner.getByLabel("Your name", { exact: true }).fill("Sam");
  await partner.getByLabel("Email", { exact: true }).fill("partner@ours.test");
  await partner
    .getByLabel("Password", { exact: true })
    .fill("ours-integration-password-2026");
  await partner
    .getByRole("button", { name: "Join our home", exact: true })
    .click();
  await expect(
    partner.getByRole("heading", { name: "Hello, Sam." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add memories", exact: true }).click();
  const first = await sharp({
    create: { width: 400, height: 500, channels: 3, background: "#a87e74" },
  })
    .jpeg()
    .toBuffer();
  const second = await sharp({
    create: { width: 500, height: 400, channels: 3, background: "#6c7b70" },
  })
    .jpeg()
    .toBuffer();
  await page.locator("input[type=file]").setInputFiles([
    { name: "memory.jpg", mimeType: "image/jpeg", buffer: first },
    { name: "second-memory.jpg", mimeType: "image/jpeg", buffer: second },
  ]);
  await page
    .getByRole("button", { name: "Upload photographs", exact: true })
    .click();
  await expect(page.getByText("Uploaded · preparing previews")).toHaveCount(2, {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "Memories", exact: true }).click();
  await expect(page.locator(".photo-open img")).toHaveCount(2, {
    timeout: 30000,
  });
  await page.getByLabel("Select memory.jpg", { exact: true }).check();
  await page.getByLabel("Select second-memory.jpg", { exact: true }).check();
  await page.getByRole("button", { name: "Add to album or Studio" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Our browser carousel");
  await page.getByRole("button", { name: "Add selected photos" }).click();
  await page.getByRole("link", { name: "Our Studio", exact: true }).click();
  await page
    .getByRole("heading", { name: "Our browser carousel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to carousel", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Add to carousel", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await page
    .getByLabel("Final caption", { exact: true })
    .fill("All the little moments. ♥");
  await page.getByLabel("Where we are").selectOption("final_review");
  await page.getByRole("button", { name: "Save our changes" }).click();
  await expect(
    page.getByRole("button", { name: "All changes saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Looks like us · Approve" }).click();
  await partner.goto(page.url());
  await partner
    .getByRole("button", { name: "Looks like us · Approve" })
    .click();
  await expect(partner.locator(".studio-status .badge")).toHaveText(
    "ready to post",
  );
  await partner.getByRole("button", { name: "Prepare our export" }).click();
  await expect(
    partner.getByRole("link", { name: "Download ordered ZIP" }),
  ).toBeVisible({ timeout: 30000 });
  const download = partner.waitForEvent("download");
  await partner.getByRole("link", { name: "Download ordered ZIP" }).click();
  expect((await download).suggestedFilename()).toBe("ours-carousel.zip");
  await page.reload();
  await page.screenshot({
    path: "test-results/desktop-studio.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-studio.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await partnerContext.close();
});
