const { chromium } = require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});const errors=[];
 for(const [name,width,height,motion] of [['desktop',1702,1043,'no-preference'],['laptop',1135,750,'no-preference'],['mobile',390,844,'reduce'],['small-mobile',320,700,'reduce']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:motion}); const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/?intro-state=final');await page.locator('#enter-site').click();await page.locator('#intro').waitFor({state:'hidden'});await page.locator('#activity-toggle').waitFor();
  const card=page.locator('.greeting-card'),module=page.locator('.activity-card');
  const before=await card.boundingBox(),compact=await module.boundingBox();
  assert.ok(Math.abs(before.x+before.width/2-width/2)<1);
  assert.equal(await page.locator('[role=grid]').count(),0);
  assert.equal(await page.locator('.activity-launcher-total strong').textContent(),'537');
  assert.ok(compact.width<before.width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.screenshot({path:`artifacts/heatmap-review/arc/${name}-collapsed.png`,fullPage:true});
  await page.locator('#activity-toggle').click();
  if(motion==='no-preference') assert.ok(await page.evaluate(()=>document.querySelector('.greeting-card').getAnimations().length>0));
  await page.waitForFunction(()=>!document.querySelector('.activity-card').dataset.animating);await page.waitForFunction(()=>document.querySelector('[role=grid]')?.dataset.reveal==='done');
  assert.equal(await page.locator('[role=gridcell]').count(),365);
  const after=await card.boundingBox(),expanded=await module.boundingBox();
  if(width>1050){assert.ok(after.x>before.x+100);assert.ok(expanded.x+expanded.width<after.x)}else assert.ok(expanded.y>after.y+after.height);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  await page.locator('[role=gridcell][data-index="100"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'107');
  await page.keyboard.press('Enter');assert.equal(await page.locator('[data-index="107"]').getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'2025',exact:true}).click();assert.equal(await page.locator('[role=gridcell]').count(),365);
  await page.getByRole('button',{name:'2026',exact:true}).click();
  await page.locator('.activity-header').click();await page.waitForTimeout(700);
  await page.screenshot({path:`artifacts/heatmap-review/arc/${name}-expanded.png`,fullPage:true});
  await page.getByRole('button',{name:'收起活动日历',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.activity-card').dataset.animating);
  await page.mouse.move(0,0);await page.waitForTimeout(350);const closed=await card.boundingBox();assert.ok(Math.abs(closed.x-before.x)<1);assert.equal(await page.locator('[role=grid]').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'activity-toggle');
  for(let n=0;n<3;n++){await page.locator('#activity-toggle').click();await page.getByRole('button',{name:'收起活动日历',exact:true}).click();}
  await page.waitForFunction(()=>!document.querySelector('.activity-card').dataset.animating);await page.mouse.move(0,0);await page.waitForTimeout(350);assert.ok(Math.abs((await card.boundingBox()).x-before.x)<1);
  await page.locator('#open-character').click();assert.equal(await module.isVisible(),false);await page.keyboard.press('Escape');assert.ok(await module.isVisible());
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: centered greeting, compact module, actual annual count, animated push and collapse, rapid toggles, four viewport sizes, reduced motion, range/selection/keyboard, scene navigation; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
