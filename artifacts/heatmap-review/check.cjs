const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'msedge' });
 const errors = [];
 for (const [name,width,height] of [['desktop',1702,1043],['laptop',1135,750],['mobile',390,844],['small-mobile',320,700]]) {
  const context = await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/?intro-state=final');
  await page.locator('#enter-site').click(); await page.locator('#intro').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('.activity-day').length > 350);
  assert.equal(await page.locator('.activity-day').count(),368);
  assert.equal(await page.locator('#activity-summary strong').textContent(),'538');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  const a = await page.locator('.activity-card').boundingBox(), g = await page.locator('.greeting-card').boundingBox();
  assert.ok(a.x>=0 && a.x+a.width<=width);
  if(width>1050) assert.ok(a.x+a.width<g.x); else assert.ok(a.y>g.y+g.height);
  await page.locator('.activity-day').last().focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),await page.locator('.activity-day').nth(360).getAttribute('aria-label'));
  assert.ok(await page.locator('#activity-tooltip').isVisible());
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#activity-tooltip').isVisible(),false);
  await page.evaluate(()=>document.activeElement.blur());
  await page.screenshot({path:`artifacts/heatmap-review/${name}.png`,fullPage:true});
  await page.locator('#open-character').click(); assert.equal(await page.locator('.activity-card').isVisible(),false);
  await page.keyboard.press('Escape'); assert.ok(await page.locator('.activity-card').isVisible());
  await context.close();
 }
 assert.deepEqual(errors,[]); await browser.close(); console.log('PASS: real counts; desktop/laptop/mobile/320px layout; keyboard, tooltip, scene navigation; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
