import { test, expect } from "@playwright/test";

test("guest can join lobby and see lobby or loading", async ({ page }) => {
  await page.goto("/");

  const joinLink = page.getByRole("link", { name: /Join (lobby|show)/i });
  if (!(await joinLink.isVisible())) {
    test.skip(true, "No upcoming show with join link");
  }

  await joinLink.click();
  await expect(page.getByText(/lobby|loading show/i)).toBeVisible({
    timeout: 30_000,
  });
});
