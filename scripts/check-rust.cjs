const {chromium}=require(process.env.LEARNLAYER_PLAYWRIGHT_MODULE || 'playwright');
const {mkdtempSync}=require('node:fs');const {tmpdir}=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const profile=mkdtempSync(path.join(tmpdir(),'learnlayer-rust-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${path.resolve('dist')}`,`--load-extension=${path.resolve('dist')}`]});
 try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page=await context.newPage();
  await page.goto('https://doc.rust-lang.org/book/ch01-00-getting-started.html');
  await page.getByRole('button',{name:/LearnLayer/}).click();
  const panel=page.locator('.ll-panel');
  await panel.getByRole('heading',{name:'The Rust Programming Language',exact:true}).waitFor();
  const snapshot=()=>worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const page=await chrome.tabs.sendMessage(tab.id,{type:'LL_SNAPSHOT'});return {id:page.course.id,count:page.course.chapters.length,title:page.course.title,first:page.course.chapters[0].title,last:page.course.chapters.at(-1).title};});
  const first=await snapshot();assert.equal(first.count,111);
  await panel.getByRole('button',{name:'Mark current chapter complete',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='1');
  await page.goto('https://doc.rust-lang.org/book/ch01-01-installation.html');
  await page.getByRole('button',{name:/LearnLayer/}).click();
  await panel.getByRole('heading',{name:'The Rust Programming Language',exact:true}).waitFor();
  const next=await snapshot();assert.equal(first.id,next.id);assert.equal(next.count,111);
  await page.waitForFunction(()=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')==='1');
  console.log(JSON.stringify({result:'PASS',...first,stableIdentityAcrossChapters:true,progressPersisted:true},null,2));
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
