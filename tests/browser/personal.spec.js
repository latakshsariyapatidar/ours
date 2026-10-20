import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("quiet copy, preserved notes and simple post download in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("All our moments.")).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("owner@ours.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ours-integration-password-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Alex." }),
  ).toBeVisible();
  await expect(page.locator(".page-heading .eyebrow")).toHaveCount(0);
  await expect(page.locator(".studio-invite")).toHaveCount(0);
  await expect(
    page.getByText(
      "Pick a few favourites. Find the words. Make something that feels like us.",
    ),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/personal-home-dark.png",
    fullPage: true,
  });

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Our Studio", exact: true })
    .click();
  await page.getByRole("button", { name: "New post", exact: true }).click();
  const title = "Just our post " + Date.now();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Notes (optional)")
    .fill("A note we wrote ourselves. ♥");
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "A note we wrote ourselves. ♥",
  );
  await expect(
    page.getByRole("heading", {
      name: /song|Our plan|Ready, together|finishing touches/i,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0);
  await expect(page.getByLabel("Where we are")).toHaveCount(0);
  await expect(page.getByLabel("Photo size")).toHaveCount(0);
  await page.getByLabel("Caption", { exact: true }).fill("Written by us.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "A note we wrote ourselves. ♥",
  );
  await expect(page.getByLabel("Caption", { exact: true })).toHaveValue(
    "Written by us.",
  );
  await page.getByLabel("Notes", { exact: true }).fill("An unsaved note");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave without saving?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep it", exact: true }).click();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "An unsaved note",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/personal-studio-dark.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Change password", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Safe, and close to home.")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create invitation", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/personal-settings-dark.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Favorites", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Favourites", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Every place. Every season. Every version of us."),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: "test-results/personal-home-light.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/personal-settings-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: "test-results/personal-home-mobile.png",
    fullPage: true,
  });
});
