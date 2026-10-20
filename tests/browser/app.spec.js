import { test, expect } from "@playwright/test";
test("authenticated library, album form and Studio at desktop and mobile sizes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@ours.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ours-integration-password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  const albumTitle = "Browser chapter " + Date.now();
  await page.getByRole("link", { name: "Albums", exact: true }).click();
  await page
    .getByRole("button", { name: "New album", exact: true })
    .first()
    .click();
  await page.getByLabel("Album title").fill(albumTitle);
  await page.getByRole("button", { name: "Create album", exact: true }).click();
  await expect(page.getByRole("heading", { name: albumTitle })).toBeVisible();
  await page.getByRole("link", { name: "Memories", exact: true }).click();
  await page.getByLabel("Search photos").fill("no-such-image");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No photographs match that search. Try another filename."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("button", { name: /View .*memory.jpg/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Photo details" }).click();
  await expect(page.getByText("Photo details")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Our Studio", exact: true })
    .click();
  await page.getByRole("button", { name: "New post" }).click();
  const draftTitle = "Browser story " + Date.now();
  await page.getByLabel("Title").fill(draftTitle);
  await page.getByRole("button", { name: "Create post" }).click();
  await expect(
    page.getByRole("heading", { name: draftTitle, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Caption", { exact: true })
    .fill("A little story from us.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
});
