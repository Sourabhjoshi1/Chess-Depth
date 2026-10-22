const { chromium } = require('/home/claude/site/tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p=await b.newPage();
await p.goto('file:///home/claude/pack/pack.html'); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
const over=await p.$$eval('.page',ps=>ps.map((x,i)=>{const kids=[...x.querySelectorAll('*')].filter(e=>!e.closest('.foot')&&!e.closest('.cover')); const r=x.getBoundingClientRect(); const max=Math.max(...kids.map(e=>e.getBoundingClientRect().bottom)); return [i+1, Math.round(r.bottom-max)];}));
console.log('space left above page bottom (px):', JSON.stringify(over));
await p.pdf({path:'/home/claude/pack/ChessDepth-Tactics-Starter-Pack.pdf',format:'A4',printBackground:true,preferCSSPageSize:true}); await b.close();})();
