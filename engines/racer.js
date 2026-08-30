// Racer engine — lane driving: accelerate, dodge obstacles, reach the finish.
// createGame(spec, assets, mount) -> { start(), destroy() }
// spec: {title, language, levels}  assets: {slug:img} (optional car sprite)

export function createGame(spec, assets, mount){
  const lang = spec.language==='en' ? 'en' : 'he';
  const T = lang==='en'
    ? {go:'Tap gas to drive!', gas:'GAS', win:'You finished! 🏁', lose:'Crashed! 💥', again:'Race again 🏁',
       next:'Next race ➡️', lvl:'Race', tapMove:'tilt / ◀ ▶ to steer'}
    : {go:'לחץ גז כדי לנסוע!', gas:'גז', win:'סיימת! 🏁', lose:'התרסקת! 💥', again:'מרוץ שוב 🏁',
       next:'למרוץ הבא ➡️', lvl:'מרוץ', tapMove:'◀ ▶ להיגוי'};
  const totalLevels=Math.max(1,spec.levels||3);
  const carImg = (()=>{ const k=Object.keys(assets||{})[0]; return k?assets[k]:null; })();

  mount.innerHTML=''; mount.style.cssText='position:absolute;inset:0;overflow:hidden;background:#1a1a2e;';
  const cv=document.createElement('canvas'); cv.style.cssText='width:100%;height:100%;display:block;touch-action:none;'; mount.appendChild(cv);
  const ctx=cv.getContext('2d');
  const hud=document.createElement('div'); hud.style.cssText='position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff;font-weight:800;font-size:clamp(13px,3.6vw,20px);text-shadow:0 2px 6px #000;pointer-events:none;z-index:5;'; mount.appendChild(hud);
  const controls=document.createElement('div'); controls.style.cssText='position:absolute;bottom:16px;left:0;right:0;display:none;justify-content:space-between;padding:0 14px;z-index:6;';
  const mk=(t,big,color)=>{const b=document.createElement('div');b.textContent=t;b.style.cssText=`width:${big?100:70}px;height:${big?100:70}px;border-radius:50%;background:${color||'rgba(255,255,255,.22)'};border:3px solid rgba(255,255,255,.6);color:#fff;font-size:${big?22:28}px;font-weight:900;display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;`;return b;};
  const bL=mk('◀'),bR=mk('▶'),bG=mk(T.gas,true,'rgba(80,220,120,.4)');
  const pl=document.createElement('div'),pr=document.createElement('div'); pl.style.cssText=pr.style.cssText='display:flex;gap:10px;';
  pl.append(bL,bR); pr.append(bG); controls.append(pl,pr); mount.appendChild(controls);
  const overlay=document.createElement('div'); overlay.style.cssText='position:absolute;inset:0;background:rgba(6,10,30,.92);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;z-index:20;'; mount.appendChild(overlay);

  let W,H; function resize(){W=cv.width=mount.clientWidth;H=cv.height=mount.clientHeight;} const ro=new ResizeObserver(resize);ro.observe(mount);resize();
  const keys={left:false,right:false,gas:false};
  let state='ready', level=1, car, obstacles, dist, goal, speed, lines, score, shake=0, boom=[];
  const img=(()=>{ if(!carImg)return null; const i=new Image();i.src=carImg;return i; })();
  let AC; const beep=(f,d=.08)=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.value=f;g.gain.setValueAtTime(.15,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d);}catch(e){}};

  function startLevel(){
    state='play'; car={x:0.5,y:0.8,vx:0}; obstacles=[]; dist=0; goal=1400+level*500; speed=0; lines=[]; score=score||0; boom=[];
    for(let i=0;i<20;i++) lines.push({y:Math.random()*H});
    controls.style.display='flex'; overlay.style.display='none';
  }
  function spawn(){ const lane=0.2+Math.random()*0.6; obstacles.push({x:lane,y:-0.1,emoji:['🚧','🛢️','🚗','🪨','🔺'][Math.floor(Math.random()*5)]}); }
  function showOverlay(title,text,btn,fn){ controls.style.display='none'; overlay.innerHTML='';
    const h=document.createElement('h1');h.style.cssText='font-size:clamp(24px,7vw,44px);margin-bottom:12px;';h.textContent=title;
    const p=document.createElement('p');p.style.cssText='opacity:.9;margin-bottom:22px;white-space:pre-line;';p.textContent=text;
    const b=document.createElement('button');b.textContent=btn;b.style.cssText='font-size:20px;font-weight:900;padding:14px 30px;border:none;border-radius:16px;background:#ffcc00;color:#222;box-shadow:0 5px 0 #c99a00;';
    b.onclick=()=>{overlay.style.display='none';fn();}; overlay.append(h,p,b); overlay.style.display='flex'; }
  function winLevel(){ state='end'; if(level>=totalLevels) showOverlay(T.win,(lang==='en'?'Score: ':'ניקוד: ')+score,T.again,()=>{level=1;score=0;startLevel();}); else showOverlay(T.lvl+' '+level+' ✅','',T.next,()=>{level++;startLevel();}); }
  function crash(){ state='end'; shake=20; beep(120,.3); navigator.vibrate&&navigator.vibrate(200); showOverlay(T.lose,(lang==='en'?'Score: ':'ניקוד: ')+score,T.again,()=>{level=1;score=0;startLevel();}); }

  function update(){
    if(state!=='play')return;
    // steering
    if(keys.left)car.vx-=0.004; if(keys.right)car.vx+=0.004; car.vx*=0.9; car.x+=car.vx;
    car.x=Math.max(0.12,Math.min(0.88,car.x));
    // speed
    speed = keys.gas ? Math.min(speed+0.4,14) : Math.max(speed-0.3,4);
    dist+=speed; score=Math.floor(dist/10);
    if(keys.gas&&Math.random()<0.3)beep(200+speed*10,.03);
    // road lines
    lines.forEach(l=>{l.y+=speed; if(l.y>H)l.y-=H;});
    // obstacles
    if(Math.random()<0.03+level*0.008)spawn();
    obstacles.forEach(o=>o.y+=speed/H);
    obstacles=obstacles.filter(o=>{
      if(o.y>0.72&&o.y<0.88&&Math.abs(o.x-car.x)<0.1){ crash(); return true; }
      return o.y<1.15;
    });
    if(dist>=goal) winLevel();
  }
  function draw(){
    ctx.fillStyle='#2a2a3e'; ctx.fillRect(0,0,W,H);
    if(state==='ready'||!car){ return; }   // nothing to draw until a race starts
    ctx.save(); if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.9;if(shake<.5)shake=0;}
    // road
    const rw=W*0.7, rx=(W-rw)/2; ctx.fillStyle='#3a3a4e'; ctx.fillRect(rx,0,rw,H);
    ctx.fillStyle='#ffd23f'; (lines||[]).forEach(l=>ctx.fillRect(W/2-4,l.y,8,30));
    ctx.strokeStyle='#fff'; ctx.lineWidth=5; ctx.strokeRect(rx,0,rw,H);
    // finish line near goal
    if(goal-dist<H){ const fy=H-(goal-dist); for(let i=0;i<rw/20;i++){ctx.fillStyle=(i%2)?'#fff':'#000';ctx.fillRect(rx+i*20,fy,20,20);} }
    // obstacles
    (obstacles||[]).forEach(o=>{ctx.font='36px serif';ctx.textAlign='center';ctx.fillText(o.emoji,o.x*W,o.y*H);});
    // car
    const cx=car.x*W, cy=car.y*H;
    if(img&&img.complete&&img.naturalWidth>0){ ctx.drawImage(img,cx-30,cy-36,60,72); }
    else { ctx.font='48px serif';ctx.textAlign='center';ctx.fillText('🏎️',cx,cy); }
    ctx.restore();
    // speed lines when fast
    if(speed>10){ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;for(let i=0;i<8;i++){const x=Math.random()*W;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,40);ctx.stroke();}}
  }

  const hold=(el,k)=>{const s=v=>e=>{e.preventDefault();keys[k]=v;};el.addEventListener('touchstart',s(true),{passive:false});el.addEventListener('touchend',s(false),{passive:false});el.addEventListener('mousedown',s(true));el.addEventListener('mouseup',s(false));el.addEventListener('mouseleave',s(false));};
  hold(bL,'left');hold(bR,'right');hold(bG,'gas');
  const kd=e=>{if(e.key==='ArrowLeft')keys.left=true;if(e.key==='ArrowRight')keys.right=true;if(e.key===' '||e.key==='ArrowUp')keys.gas=true;};
  const ku=e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;if(e.key===' '||e.key==='ArrowUp')keys.gas=false;};
  addEventListener('keydown',kd);addEventListener('keyup',ku);

  let raf; function loop(){ update(); draw();
    if(state==='play')hud.textContent='🏁 '+Math.min(100,Math.floor(dist/goal*100))+'%  ⚡'+Math.floor(speed)+'  ⭐'+score+'  '+T.lvl+' '+level+'/'+totalLevels;
    else hud.textContent='';
    raf=requestAnimationFrame(loop); }

  return {
    start(){ score=0; showOverlay(spec.title||T.lvl, T.go, T.gas+' 🏁', ()=>{level=1;score=0;startLevel();}); loop(); },
    destroy(){ cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown',kd); removeEventListener('keyup',ku); mount.innerHTML=''; }
  };
}
