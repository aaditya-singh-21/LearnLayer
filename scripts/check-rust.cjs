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
  const snapshot=()=>worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const page=await chrome.tabs.sendMessage(tab.id,{type:'LL_SNAPSHOT'});const chapters=page.course.chapters,parents=new Set(chapters.map(c=>c.parentId)),leaves=chapters.filter(c=>!parents.has(c.id));const current=chapters.find(c=>c.url===page.currentUrl),branch=new Set(current?[current.id]:[]);for(let i=0;i<chapters.length;i++)for(const c of chapters)if(branch.has(c.parentId))branch.add(c.id);return {id:page.course.id,count:chapters.length,roots:chapters.filter(c=>!c.parentId).length,title:page.course.title,first:chapters[0].title,last:chapters.at(-1).title,branchPercent:Math.round(leaves.filter(c=>branch.has(c.id)).length/leaves.length*100)};});
  const first=await snapshot();assert.equal(first.count,111);assert.ok(first.roots<first.count);
  await panel.getByRole('button',{name:'Mark current chapter complete',exact:true}).click();
  await page.waitForFunction(percent=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')===String(percent),first.branchPercent);
  await page.goto('https://doc.rust-lang.org/book/ch01-01-installation.html');
  await page.getByRole('button',{name:/LearnLayer/}).click();
  await panel.getByRole('heading',{name:'The Rust Programming Language',exact:true}).waitFor();
  const next=await snapshot();assert.equal(first.id,next.id);assert.equal(next.count,111);
  await page.waitForFunction(percent=>document.querySelector('#learnlayer-root').shadowRoot.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')===String(percent),first.branchPercent);
  console.log(JSON.stringify({result:'PASS',...first,stableIdentityAcrossChapters:true,progressPersisted:true},null,2));
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
