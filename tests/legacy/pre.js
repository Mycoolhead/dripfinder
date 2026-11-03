const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
const block=fs.readFileSync(require('path').join(__dirname,'../../embeds/dripit/dripit-embed-block.html'),'utf8');
await p.route('https://dripitivsolutions.com/find-your-drip*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="font-family:Inter;margin:0;padding:16px">${block}</body></html>`}));
await p.goto('https://dripitivsolutions.com/find-your-drip?feel=hungover&src=home-chip');
await p.waitForTimeout(800);
const pressed=await p.locator('#drip-finder button.opt[aria-pressed="true"]').allTextContents();
console.log('preselected',pressed);
await p.screenshot({path:require('path').join(__dirname,'pre_m.png')});await b.close();})();
