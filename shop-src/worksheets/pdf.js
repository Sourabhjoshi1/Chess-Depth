const { chromium } = require('/home/claude/site/tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p=await b.newPage();
for (const [h,out] of process.argv.slice(2).map(x=>x.split(':'))) {
await p.goto('file:///home/claude/shop/build/'+h); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(400);
const over=await p.$$eval('.page',ps=>ps.map((x,i)=>{const kids=[...x.querySelectorAll('*')].filter(e=>!e.closest('.foot')&&!e.closest('.cover')); const r=x.getBoundingClientRect(); const max=Math.max(...kids.map(e=>e.getBoundingClientRect().bottom)); return [i+1, Math.round(r.bottom-max)];}));
console.log(h, 'space left (px):', JSON.stringify(over.filter(o=>o[1]<70)));
await p.pdf({path:'/home/claude/shop/build/'+out,format:'A4',printBackground:true,preferCSSPageSize:true}); }
await b.close();})();
