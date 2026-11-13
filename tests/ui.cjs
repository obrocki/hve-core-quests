const { chromium } = require("playwright");
const { pathToFileURL } = require("url");
const path = require("path");
const assert = require("assert").strict;

(async () => {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(root, "app", "web", "index.html")).href);
    await page.waitForSelector("#flights tr");
    assert.match(await page.locator("#connection").innerText(), /Local training mode/);
    assert.equal(await page.locator("#flights tr").count(), 4);
    await page.locator("#flights tr").first().click();
    await page.locator('[data-seat="14C"]').click();
    await page.screenshot({ path: path.join(root, "docs", "images", "eagledesk.png") });
    if (!process.argv.includes("--screenshot-only")) {
      await page.locator("#hold").click();
      assert.match(await page.locator("#hold-result").innerText(), /held locally/);
      await page.locator("#hold").click();
      assert.match(await page.locator("#hold-result").innerText(), /already held/);
      await page.reload();
      await page.locator("#flights tr").first().click();
      await page.locator('[data-seat="14C"]').click();
      await page.locator("#hold").click();
      assert.match(await page.locator("#hold-result").innerText(), /already held/);
      await page.selectOption("#origin", "JFK");
      await page.locator("#search").click();
      assert.equal(await page.locator("#flights tr").count(), 1);
      console.log("Offline flight search, seat hold, persistence and screenshot passed.");
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
