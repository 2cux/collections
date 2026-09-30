const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  const first = await browser.newContext({ viewport: { width: 1445, height: 1169 } });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await first.newPage(), b = await second.newPage();
  for (const page of [a,b]) {
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/?intro-state=final');
    await page.locator('#enter-site').click();
    await page.locator('#intro').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('#like-count').textContent !== '—');
  }
  const initial = Number(await a.locator('#like-count').textContent());
  await a.locator('#like-button').click();
  await b.waitForFunction(n => Number(document.querySelector('#like-count').textContent) === n, initial + 1);
  assert.equal(await a.locator('#like-button').getAttribute('aria-pressed'), null);
  await a.screenshot({ path: 'artifacts/likes-review/desktop.png' });
  await b.screenshot({ path: 'artifacts/likes-review/mobile.png' });
  await a.reload();
  await a.locator('#enter-site').click();
  await a.locator('#intro').waitFor({ state: 'hidden' });
  await a.waitForFunction(n => Number(document.querySelector('#like-count').textContent) === n, initial + 1);
  await a.locator('#like-button').click();
  await b.waitForFunction(n => Number(document.querySelector('#like-count').textContent) === n, initial + 2);
  const rect = await b.locator('.like-dock').boundingBox();
  assert.ok(rect.x >= 0 && rect.x + rect.width <= 390 && rect.y + rect.height <= 844);
  assert.equal(await b.evaluate(() => document.documentElement.scrollWidth), 390);
  await a.locator('#open-character').click();
  assert.equal(await a.locator('#like-button').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile layout, two-visitor realtime update, count on reload, repeated increments, scene visibility, no runtime errors.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
