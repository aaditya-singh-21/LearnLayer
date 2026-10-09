// Live installed-extension check for a query-routed curriculum (isolated profile).
const { chromium } = require(process.env.LEARNLAYER_PLAYWRIGHT_MODULE || 'playwright');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(),'learnlayer-query-course-')), {
    channel:'chromium',headless:true,args:[`--disable-extensions-except=${path.resolve('dist')}`,`--load-extension=${path.resolve('dist')}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const site='https://aiengineeringfromscratch.com';
    const lesson=site+'/lesson?path=phases/06-speech-and-audio/01-audio-fundamentals';
    const snapshot=()=>worker.evaluate(async()=>{
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      const value=await chrome.tabs.sendMessage(tab.id,{type:'LL_SNAPSHOT'});
      return {id:value.course?.id,title:value.course?.title,sourceUrl:value.course?.sourceUrl,chapters:value.course?.chapters,detector:value.detection?.selected?.detectorId,status:value.detection?.status};
    });
    await page.goto(lesson);
    await page.getByRole('button',{name:/LearnLayer/}).click();
    const panel=page.locator('.ll-panel');
    await panel.getByRole('heading',{name:'Phase 06 · Speech & Audio',exact:true}).waitFor();
    const first=await snapshot();assert.equal(first.status,'detected');assert.equal(first.chapters.length,17);
    assert.ok(first.chapters.every(c=>new URL(c.url).searchParams.get('path').startsWith('phases/06-speech-and-audio/')));
    await panel.getByRole('button',{name:'Mark current chapter complete',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='6');
    await panel.getByRole('button',{name:'Continue learning',exact:false}).click();
    await page.waitForURL(url=>url.searchParams.get('path')==='phases/06-speech-and-audio/02-spectrograms-mel-features');
    await page.getByRole('button',{name:/LearnLayer/}).click();
    await panel.getByRole('heading',{name:first.title,exact:true}).waitFor();
    const next=await snapshot();assert.equal(next.id,first.id);assert.deepEqual(next.chapters.map(c=>c.id),first.chapters.map(c=>c.id));
    await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='6');
    await page.reload();await page.getByRole('button',{name:/LearnLayer/}).click();
    await panel.getByRole('heading',{name:first.title,exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='6');
    await page.goto(site+'/lesson?path=phases/07-transformers-deep-dive/01-why-transformers');
    await page.getByRole('button',{name:/LearnLayer/}).click();
    const other=await snapshot();assert.ok(other.chapters.length>=3);assert.notEqual(other.id,first.id);
    assert.ok(other.chapters.every(c=>new URL(c.url).searchParams.get('path').startsWith('phases/07-transformers-deep-dive/')));
    await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='0');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',title:first.title,chapters:first.chapters.length,sourceUrl:first.sourceUrl,stableIdentity:true,progressAfterNavigationAndReload:true,adjacentPhaseExcluded:true,separatePhaseIdentity:true},null,2));
  } finally { await context.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
