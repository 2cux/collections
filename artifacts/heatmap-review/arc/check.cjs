const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'msedge' });
 const errors = [];
 for (const [name,width,height,motion] of [['desktop',1702,1043,'no-preference'],['laptop',1135,750,'reduce'],['mobile',390,844,'reduce'],['small-mobile',320,700,'reduce']]) {
  const context = await browser.newContext({viewport:{width,height},reducedMotion:motion});
  const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/?intro-state=final');
  await page.locator('#enter-site').click(); await page.locator('#intro').waitFor({state:'hidden'});
  await page.locator('#activity-toggle').click(); await page.getByRole('button',{name:'近一年',exact:true}).click();
  const grid=page.locator('#activity-root [role=grid]');
  await grid.waitFor(); await page.waitForFunction(()=>document.querySelector('#activity-root [role=grid]').dataset.reveal==='done');
  assert.equal(await grid.locator('[role=gridcell]').count(),368);
  assert.ok((await page.locator('#activity-root [role=status]').textContent()).startsWith('538 contributions'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  const a = await page.locator('.activity-card').boundingBox(), g = await page.locator('.greeting-card').boundingBox();
  assert.ok(a.x>=0 && a.x+a.width<=width);
  if(width>1050) assert.ok(a.x+a.width<g.x); else assert.ok(a.y>g.y+g.height);
  const last=grid.locator('[data-index="367"]'); await last.focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'360');
  await page.keyboard.press('Enter'); assert.equal(await grid.locator('[data-index="360"]').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Escape');
  const level=page.locator('#activity-root [data-level-key="4"]'); await level.click();
  assert.equal(await level.getAttribute('aria-pressed'),'true'); assert.equal(await grid.getAttribute('data-highlight'),'4');
  await level.click(); await page.locator('.activity-header').click(); await page.waitForFunction(()=>!document.querySelector('#activity-root [role=grid]').hasAttribute('data-highlight'));
  await page.getByRole('button',{name:'2026',exact:true}).click();
  assert.equal(await grid.locator('[role=gridcell]').count(),273);
  assert.ok((await page.locator('#activity-root [role=status]').textContent()).endsWith('in 2026'));
  await page.getByRole('button',{name:'近一年',exact:true}).click(); assert.equal(await grid.locator('[role=gridcell]').count(),368);
  await page.evaluate(()=>document.activeElement.blur()); await page.waitForTimeout(650);
  await page.screenshot({path:`artifacts/heatmap-review/arc/${name}.png`,fullPage:true});
  if(width===1702) {
   await grid.locator('[data-index="240"]').hover(); await page.waitForTimeout(400);
   await page.screenshot({path:'artifacts/heatmap-review/arc/tooltip.png',fullPage:true});
  }
  await page.locator('#open-character').click(); assert.equal(await page.locator('.activity-card').isVisible(),false);
  await page.keyboard.press('Escape'); assert.ok(await page.locator('.activity-card').isVisible());
  await context.close();
 }
 assert.deepEqual(errors,[]); await browser.close(); console.log('PASS: official Arc grid, counts, four viewport sizes, diagonal reveal, date selection, keyboard navigation, legend filter, period switching, scene navigation; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
