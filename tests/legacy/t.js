const { chromium } = require('playwright');
const fs=require('fs');
(async()=>{
 const block=fs.readFileSync(require('path').join(__dirname,'../../embeds/dripit/dripit-embed-block.html'),'utf8');
 const page_html=`<!doctype html><html><body style="font-family:Inter"><h1>Test</h1>${block}</body></html>`;
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 const run=async(feel,week,client,safety)=>{
  await p.goto("about:blank"); await p.setContent(page_html);
  const host=p.locator('#drip-finder');
  const click=async t=>{await host.locator('button.opt',{hasText:t}).first().click();};
  for(const f of feel) await click(f);
  await host.locator('button.btn',{hasText:'Next'}).click();
  await click(week); await click(client);
  for(const s of safety) await click(s);
  await host.locator('button.btn',{hasText:'See my match'}).click();
  const h3=await host.locator('h3').allTextContents();
  const h2=await host.locator('h2').textContent();
  const tips=await host.locator('.tip').allTextContents();
  const book=await host.locator('a.btn').first().getAttribute('href');
  const alts=await host.locator('.alt b').allTextContents();
  return {h2,h3,tips:tips.map(t=>t.slice(0,40)),book:(book||'').slice(0,120),alts};
 };
 const cases=[
  [['Hungover'],'A big night','No, this','None of these'.split('|')],
  [['Sore muscles'],'Training','Yes,',['None of these']],
  [['Tired'],'Work and life','Yes,',['None of these']],
  [['Want my skin'],'A big event','Yes,',['None of these']],
  [['Feeling run down'],'A bug going','No, this',['None of these']],
  [['Dehydrated'],'Long days','Yes,',['None of these']],
  [['Nauseous','Headache'],'A big night','Yes,',['None of these']],
  [['Tired'],'Just regular','Yes,',['Pregnant']],
  [['Tired'],'Just regular','Yes,',['Chest pain']],
 ];
 for(const c of cases){ console.log(JSON.stringify(c[0]),c[1],'=>',JSON.stringify(await run(...c))); }
 await p.goto("about:blank"); await p.setContent(page_html); await p.screenshot({path:require('path').join(__dirname,'q1.png'),fullPage:true});
 await run(['Hungover'],'A big night','No, this',['None of these']); await p.screenshot({path:require('path').join(__dirname,'res.png'),fullPage:true});
 console.log('ERRORS',errs);
 await b.close();
})();
