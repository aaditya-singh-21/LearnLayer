const {chromium}=require(process.env.LEARNLAYER_PLAYWRIGHT_MODULE || 'playwright');
const {mkdtempSync}=require('node:fs');const {tmpdir}=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const context=await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(),'learnlayer-python-')),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${path.resolve('dist')}`,`--load-extension=${path.resolve('dist')}`]});
 try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');const page=await context.newPage();
  const snapshot=()=>worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const page=await chrome.tabs.sendMessage(tab.id,{type:'LL_SNAPSHOT'});const catalog=(await chrome.storage.local.get('ll:v2:catalog'))['ll:v2:catalog'];return {id:page.course?.id,count:page.course?.chapters.length,title:page.course?.title,membership:catalog[page.course?.id]?.membership};});
  await page.goto('https://docs.python.org/3/tutorial/');await page.getByRole('button',{name:/LearnLayer/}).click();
  const panel=page.locator('.ll-panel');await panel.getByRole('heading',{name:'The Python Tutorial',exact:true}).waitFor();
  const root=await snapshot();assert.equal(root.count,16);assert.equal(root.membership,null);
  await page.getByRole('link',{name:'3. An Informal Introduction to Python',exact:true}).click();
  await page.getByRole('button',{name:/LearnLayer/}).click();await panel.getByRole('heading',{name:'The Python Tutorial',exact:true}).waitFor();
  const chapter=await snapshot();assert.equal(chapter.id,root.id);assert.equal(chapter.count,16);assert.equal(chapter.membership,null);
  await panel.getByRole('button',{name:'Mark current chapter complete',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='6');
  await page.goto('https://docs.python.org/3/tutorial/controlflow.html');
  await page.getByRole('button',{name:/LearnLayer/}).click();await panel.getByRole('heading',{name:'The Python Tutorial',exact:true}).waitFor();
  const next=await snapshot();assert.equal(next.id,root.id);assert.equal(next.count,16);assert.equal(next.membership,'recent');
  await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='6');
  console.log(JSON.stringify({result:'PASS',...root,fullTutorialRetainedBeforeCompletion:true,progressAcrossChapters:true},null,2));
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
