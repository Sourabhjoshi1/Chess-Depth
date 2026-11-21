import { read, fenBoard } from './sim.mjs';
const U='/mnt/user-data/uploads/', E='/home/claude/site/repo/assets/ai/examples/';
const cases=[[E+'example-1.png'],[E+'example-2.png'],[E+'example-3.jpg'],[U+'0c2d18b4-WhatsApp_Image_2026-11-16_at_12.48.52.jpeg','6k1/1q4np/4pP2/p1p1Q1p1/P4nP1/2P3R1/1P5P/3r1RK1'],[U+'4254b9ce-IMG_1265.png','2krr1q1/pp1b4/1QnB1p2/3p2p1/7p/2N2P2/PPP3PP/R4RK1'],[U+'51adb05d-IMG_1084.jpeg','8/p1bn3r/1pkN1p2/4pN1q/2b5/2P2Pp1/PP6/R2Q1BK1']];
const det=process.argv[2]||null, guard=process.argv[3]?+process.argv[3]:null;
for (const [f,truth] of cases){ const r=await read(f,{detect:det,guard}); console.log(f.split('/').pop().slice(0,22).padEnd(23), fenBoard(r.board).padEnd(45), r.found?('conf '+r.found.conf.toFixed(2)+' size '+Math.round(r.found.size)):'NOT FOUND', 'wb',r.whiteBottom, truth?(fenBoard(r.board)===truth?'OK':'WRONG'):''); }
