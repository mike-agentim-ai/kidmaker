// Brawler engine — team vs team, scrolling stages, stomp + punch juice.
// Interface: createGame(spec, assets, mount) -> { start(), destroy() }
// spec: {title, language, levels, sides:[{label,members:[names]}], ...}
// assets: {slug: imageURL}  — sprites for characters (by name-slug); falls back to emoji.

const FALLBACK_EMOJI = ['🦔','🦸','🐲','🤖','🦖','🐯','⚡','👾','🐸','🦍'];

export function createGame(spec, assets, mount){
  const lang = spec.language==='en' ? 'en' : 'he';
  const T = lang==='en'
    ? {choose:'Choose your fighter!', vs:'vs', play:'Play! 🎮', win:'You win! 🏆', lose:'You lost 💥',
       again:'Play again 🎮', next:'Next stage ➡️', stage:'Stage', tapSwap:'(tap top = switch)'}
    : {choose:'בחר את הגיבור!', vs:'נגד', play:'שחק! 🎮', win:'ניצחתם! 🏆', lose:'הפסדתם 💥',
       again:'שחק שוב 🎮', next:'לשלב הבא ➡️', stage:'שלב', tapSwap:'(לחיצה למעלה = החלף)'};

  // resolve members -> {name, img|emoji}
  const slug = s => (s||'').toString().trim().toLowerCase().replace(/\s+/g,'_').replace(/[^\w\u0590-\u05ff]/g,'');
  let ei = 0;
  const pickAsset = name => {
    const k = slug(name);
    // try direct key, or any asset key that contains it
    if(assets[k]) return {name, img:assets[k]};
    const hit = Object.keys(assets).find(a=>a.includes(k)||k.includes(a));
    if(hit) return {name, img:assets[hit]};
    return {name, emoji:FALLBACK_EMOJI[(ei++)%FALLBACK_EMOJI.length]};
  };
  const sides = (spec.sides && spec.sides.length>=2) ? spec.sides
              : [{label:T.choose, members:['גיבור']},{label:'', members:['אויב']}];
  const teamChars = (sides[0].members||[]).map(pickAsset);
  const foeChars  = (sides[1].members||[]).map(pickAsset);
  const totalLevels = Math.max(1, spec.levels||3);

  // ---- DOM ----
  mount.innerHTML = '';
  mount.style.cssText='position:absolute;inset:0;overflow:hidden;background:#0b1026;';
  const cv=document.createElement('canvas'); cv.style.cssText='width:100%;height:100%;display:block;touch-action:none;'; mount.appendChild(cv);
  const ctx=cv.getContext('2d');
  const hud=document.createElement('div'); hud.style.cssText='position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff;font-weight:800;font-size:clamp(13px,3.6vw,20px);text-shadow:0 2px 6px #000;pointer-events:none;z-index:5;'; mount.appendChild(hud);

  const controls=document.createElement('div');
  controls.style.cssText='position:absolute;bottom:16px;left:0;right:0;display:none;justify-content:space-between;padding:0 14px;z-index:6;';
  const mkBtn=(txt,big)=>{const b=document.createElement('div');b.textContent=txt;
    b.style.cssText=`width:${big?104:70}px;height:${big?104:70}px;border-radius:50%;background:${big?'rgba(255,70,70,.42)':'rgba(255,255,255,.22)'};border:3px solid ${big?'rgba(255,150,150,.9)':'rgba(255,255,255,.55)'};color:#fff;font-size:${big?40:28}px;font-weight:900;display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;`;return b;};
  const bL=mkBtn('◀'),bR=mkBtn('▶'),bJ=mkBtn('⤴'),bH=mkBtn('👊',true);
  const padL=document.createElement('div'),padR=document.createElement('div');
  padL.style.cssText=padR.style.cssText='display:flex;gap:10px;';
  padL.append(bL,bR); padR.append(bJ,bH); controls.append(padL,padR); mount.appendChild(controls);

  const overlay=document.createElement('div');
  overlay.style.cssText='position:absolute;inset:0;background:rgba(6,10,30,.92);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;z-index:20;';
  mount.appendChild(overlay);

  // ---- state ----
  let W,H,groundY;
  function resize(){ W=cv.width=mount.clientWidth; H=cv.height=mount.clientHeight; groundY=H*0.66; }
  const ro=new ResizeObserver(resize); ro.observe(mount); resize();

  const keys={left:false,right:false};
  let state='select', level=1, active=0, shake=0;
  let team=[], foes=[], particles=[], coins=[], pops=[], flashes=[], rings=[], score=0;
  const world={w:2200,cam:0};
  const imgCache={};
  const img=src=>{ if(!src)return null; if(!imgCache[src]){const i=new Image();i.src=src;imgCache[src]=i;} return imgCache[src]; };

  let AC; const boop=(f,d=0.08)=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=f;o.frequency.exponentialRampToValueAtTime(f*0.5,AC.currentTime+d*0.8);g.gain.setValueAtTime(0.2,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d);}catch(e){}};

  // ---- entity factory ----
  const drawnEmoji={};
  function entSprite(c,size){
    if(c.img) return {img:img(c.img)};
    // render emoji to a canvas once
    const key=c.emoji+size;
    if(!drawnEmoji[key]){ const o=document.createElement('canvas');o.width=o.height=size;const x=o.getContext('2d');x.font=`${size*0.8}px serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(c.emoji,size/2,size/2);drawnEmoji[key]=o; }
    return {img:drawnEmoji[key]};
  }

  function startLevel(){
    state='play'; world.cam=0;
    team = teamChars.map((c,i)=>({...c,spr:entSprite(c,96),x:60+i*22,y:groundY-74,vy:0,w:56,h:70,face:1,onGround:true,punch:0,hp:5,flash:0,dead:false}));
    active=0;
    foes = foeChars.map((c,i)=>{ const boss=i===foeChars.length-1;
      return {...c,spr:entSprite(c,boss?120:80),x:520+i*((world.w-720)/Math.max(1,foeChars.length)),y:groundY-(boss?96:66),w:boss?92:58,h:boss?96:66,dir:-1,hp:(boss?4:2)+(level-1),hit:0,knock:0,dead:false,boss,t:Math.random()*6}; });
    coins=[]; for(let i=0;i<10;i++)coins.push({x:250+Math.random()*(world.w-450),y:groundY-70-Math.random()*140,t:Math.random()*6});
    particles=[];pops=[];flashes=[];rings=[];
    controls.style.display='flex'; overlay.style.display='none';
  }
  function cur(){ return team[active]; }
  function swap(){ if(state!=='play'||team.length<2)return; let n=active; for(let k=0;k<team.length;k++){n=(n+1)%team.length;if(!team[n].dead){active=n;boop(700);break;}} }
  function jump(){ if(state!=='play')return; const h=cur(); if(h&&h.onGround){h.vy=-15;h.onGround=false;boop(420,.1);} }
  function hit(){
    if(state!=='play')return; const h=cur(); if(!h)return; h.punch=12; boop(180); navigator.vibrate&&navigator.vibrate(40);
    const reach=70,px=h.x+(h.face>0?h.w:-reach);
    foes.forEach(f=>{ if(f.dead||f.hit>0)return;
      if(px<f.x+f.w&&px+reach>f.x&&Math.abs(h.y-f.y)<110){
        f.hp--;f.hit=16;f.knock=h.face*7;score+=f.boss?100:50;shake=f.boss?18:12;
        const ix=f.x+(h.face>0?0:f.w),iy=f.y+f.h*0.4;
        pops.push({t:18,x:f.x+f.w/2,y:f.y,txt:f.boss?'BAM!':'POW!'}); flashes.push({t:8,x:ix,y:iy,r:f.boss?46:34}); rings.push({t:16,x:ix,y:iy,r:8,vr:f.boss?4:3});
        boop(f.boss?120:240,.14); navigator.vibrate&&navigator.vibrate(f.boss?80:50); h.x+=-h.face*6;
        for(let i=0;i<(f.boss?26:18);i++){const a=Math.random()*6.28,sp=2+Math.random()*9;particles.push({x:ix,y:iy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:22+Math.random()*10,c:Math.random()<.4?'#fff':(Math.random()<.6?'#ffd23f':'#ff5a3c')});}
        if(f.hp<=0){f.dead=true;score+=f.boss?200:60;pops.push({t:26,x:f.x+f.w/2,y:f.y-10,txt:'💥'});rings.push({t:22,x:f.x+f.w/2,y:f.y+f.h/2,r:10,vr:6});
          for(let i=0;i<28;i++)particles.push({x:f.x+f.w/2,y:f.y,vx:(Math.random()-.5)*13,vy:-Math.random()*11,life:32,c:'#fff'});
          if(foes.every(e=>e.dead)) winLevel();}
      }});
  }
  function winLevel(){
    state='levelend';
    if(level>=totalLevels) showOverlay(T.win, (lang==='en'?'Score: ':'ניקוד: ')+score, T.again, ()=>{level=1;score=0;startLevel();});
    else showOverlay(T.stage+' '+level+' ✅', (lang==='en'?'Score: ':'ניקוד: ')+score, T.next, ()=>{level++;startLevel();});
  }
  function lose(){ state='dead'; showOverlay(T.lose,(lang==='en'?'Score: ':'ניקוד: ')+score,T.again,()=>{level=1;score=0;startLevel();}); }

  function showOverlay(title, text, btn, onBtn){
    controls.style.display='none';
    overlay.innerHTML='';
    const h=document.createElement('h1'); h.style.cssText='font-size:clamp(24px,7vw,44px);margin-bottom:12px;'; h.textContent=title;
    const p=document.createElement('p'); p.style.cssText='opacity:.9;margin-bottom:22px;white-space:pre-line;'; p.textContent=text;
    const b=document.createElement('button'); b.textContent=btn; b.style.cssText='font-size:20px;font-weight:900;padding:14px 30px;border:none;border-radius:16px;background:#ffcc00;color:#222;box-shadow:0 5px 0 #c99a00;';
    b.onclick=()=>{ overlay.style.display='none'; onBtn(); };
    overlay.append(h,p,b); overlay.style.display='flex';
  }

  // ---- character select overlay ----
  function showSelect(){
    state='select'; controls.style.display='none';
    overlay.innerHTML='';
    const h=document.createElement('h1'); h.style.cssText='font-size:clamp(22px,6vw,38px);margin-bottom:6px;'; h.textContent=spec.title||T.choose;
    const sub=document.createElement('p'); sub.style.cssText='opacity:.8;margin-bottom:16px;font-size:15px;';
    sub.textContent = sides[0].members.join(' + ')+' '+T.vs+' '+sides[1].members.join(' + ');
    // pick which of your team to start controlling
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;';
    teamChars.forEach((c,i)=>{
      const card=document.createElement('div'); card.style.cssText=`display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;border-radius:14px;border:3px solid ${i===0?'#ffcc00':'transparent'};background:rgba(255,255,255,.08);cursor:pointer;min-width:84px;`;
      const im=document.createElement(c.img?'img':'div');
      if(c.img){ im.src=c.img; im.style.cssText='height:70px;width:auto;'; } else { im.textContent=c.emoji; im.style.cssText='font-size:56px;'; }
      const nm=document.createElement('span'); nm.textContent=c.name; nm.style.cssText='font-size:13px;font-weight:800;';
      card.append(im,nm); card.onclick=()=>{active=i;boop(600);row.querySelectorAll('div').forEach(()=>{});Array.from(row.children).forEach(ch=>ch.style.borderColor='transparent');card.style.borderColor='#ffcc00';};
      row.appendChild(card);
    });
    const b=document.createElement('button'); b.textContent=T.play; b.style.cssText='font-size:20px;font-weight:900;padding:14px 30px;border:none;border-radius:16px;background:#ffcc00;color:#222;box-shadow:0 5px 0 #c99a00;';
    b.onclick=()=>{ level=1;score=0; startLevel(); };
    overlay.append(h,sub,row,b); overlay.style.display='flex';
  }

  // ---- update ----
  function update(){
    if(state!=='play'){ particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.4;p.life--;}); particles=particles.filter(p=>p.life>0); return; }
    const h=cur();
    if(h){ const spd=4.6; if(keys.left){h.x-=spd;h.face=-1;} if(keys.right){h.x+=spd;h.face=1;}
      h.x=Math.max(0,Math.min(world.w-h.w,h.x)); h.vy+=.8;h.y+=h.vy; if(h.y>=groundY-h.h){h.y=groundY-h.h;h.vy=0;h.onGround=true;}
      if(h.punch>0)h.punch--; world.cam=Math.max(0,Math.min(world.w-W,h.x-W*.35)); }
    team.forEach((t,i)=>{ if(t.flash>0)t.flash--; if(i===active||t.dead)return; t.vy+=.8;t.y+=t.vy; if(t.y>=groundY-t.h){t.y=groundY-t.h;t.vy=0;} const tg=cur(); if(tg){t.x+=Math.max(-3,Math.min(3,(tg.x-40*(i+1)-t.x)*.05));t.face=tg.face;} });
    foes.forEach(f=>{ if(f.dead)return; if(f.hit>0)f.hit--; f.t+=.05; if(f.knock){f.x+=f.knock;f.knock*=.8;if(Math.abs(f.knock)<.5)f.knock=0;}
      const alive=team.filter(t=>!t.dead); if(!alive.length)return;
      let tg=alive.reduce((a,b)=>Math.abs(b.x-f.x)<Math.abs(a.x-f.x)?b:a);
      if(Math.abs(tg.x-f.x)<340||f.boss){f.dir=tg.x<f.x?-1:1;f.x+=f.dir*(f.boss?1.5:1.2);} else {f.x+=f.dir*.8;if(f.x<250)f.dir=1;if(f.x>world.w-200)f.dir=-1;}
      // stomp
      team.forEach(t=>{ if(t.dead||f.dead||f.hit>0)return; const ox=t.x<f.x+f.w&&t.x+t.w>f.x, fall=t.vy>2, head=(t.y+t.h)-f.y<26&&(t.y+t.h)>f.y-4;
        if(ox&&fall&&head){ f.hp--;f.hit=16;t.vy=-11;score+=f.boss?100:50;shake=f.boss?12:8; pops.push({t:18,x:f.x+f.w/2,y:f.y-6,txt:'STOMP!'});boop(520,.1);navigator.vibrate&&navigator.vibrate(50);
          for(let i=0;i<14;i++)particles.push({x:f.x+f.w/2,y:f.y,vx:(Math.random()-.5)*9,vy:-Math.random()*6,life:22,c:'#7ec8ff'});
          if(f.hp<=0){f.dead=true;score+=f.boss?200:60;pops.push({t:24,x:f.x+f.w/2,y:f.y-10,txt:'💥'});for(let i=0;i<24;i++)particles.push({x:f.x+f.w/2,y:f.y,vx:(Math.random()-.5)*12,vy:-Math.random()*10,life:30,c:'#fff'});if(foes.every(e=>e.dead))winLevel();} } });
      // side damage
      team.forEach(t=>{ if(t.dead||t.flash>0||f.dead)return; const stomp=t.vy>2&&(t.y+t.h)-f.y<30;
        if(!stomp&&t.x<f.x+f.w&&t.x+t.w>f.x&&t.y<f.y+f.h&&t.y+t.h>f.y){ t.hp--;t.flash=60;t.vy=-8;t.x+=t.face>0?-40:40;boop(90);
          for(let i=0;i<8;i++)particles.push({x:t.x,y:t.y+20,vx:(Math.random()-.5)*6,vy:-Math.random()*5,life:18,c:'#ff5a5a'});
          if(t.hp<=0){t.dead=true;pops.push({t:20,x:t.x+t.w/2,y:t.y,txt:'😵'}); if(team.every(x=>x.dead))lose(); else if(t===cur())swap();} } });
    });
    coins=coins.filter(c=>{c.t+=.08;const h=cur();if(h&&Math.abs((h.x+h.w/2)-c.x)<32&&Math.abs((h.y+h.h/2)-c.y)<46){score+=25;boop(800,.06);return false;}return true;});
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.4;p.life--;}); particles=particles.filter(p=>p.life>0);
  }

  function spr(s,x,y,w,h,face,flash){ ctx.save(); if(flash>0&&Math.floor(flash/4)%2===0)ctx.globalAlpha=.4;
    const im=s.img; if(im&&(im.complete!==false)&&(im.naturalWidth===undefined||im.naturalWidth>0)){ctx.translate(x+w/2,y+h/2);if(face<0)ctx.scale(-1,1);ctx.drawImage(im,-w/2,-h/2,w,h);} ctx.restore(); }

  function draw(){
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#6db3ff');g.addColorStop(.55,'#a8d8ff');g.addColorStop(.55,'#7ec850');g.addColorStop(1,'#5fa93f');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.save(); if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.85;if(shake<.5)shake=0;} ctx.translate(-world.cam,0);
    ctx.fillStyle='rgba(255,255,255,.5)'; for(let i=0;i<10;i++){const cx=i*260-world.cam*.3;ctx.beginPath();ctx.arc(cx,90,24,0,7);ctx.arc(cx+26,90,30,0,7);ctx.arc(cx+56,90,22,0,7);ctx.fill();}
    ctx.font='38px serif'; ctx.fillText('🚩',world.w-120,groundY-6);
    coins.forEach(c=>{ctx.save();ctx.translate(c.x,c.y+Math.sin(c.t)*6);ctx.font='24px serif';ctx.textAlign='center';ctx.fillText('⭐',0,0);ctx.restore();});
    foes.forEach(f=>{ if(f.dead)return; spr(f.spr,f.x,f.y,f.w,f.h,f.dir>0?1:-1,f.hit); for(let i=0;i<f.hp;i++){ctx.font='15px serif';ctx.textAlign='left';ctx.fillText('❤️',f.x+i*17,f.y-6);} });
    team.forEach((t,i)=>{ if(t.dead||i===active)return; spr(t.spr,t.x,t.y,t.w,t.h,t.face,t.flash); });
    const h=cur(); if(h){ spr(h.spr,h.x-6,h.y-12,h.w+12,h.h+16,h.face,h.flash); if(h.punch>0){ctx.font='26px serif';ctx.textAlign='center';ctx.fillText('👊',h.x+(h.face>0?h.w+12:-12),h.y+30);}
      ctx.fillStyle='#fff';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=3;ctx.strokeText('▶ '+h.name,h.x+h.w/2,h.y-16);ctx.fillText('▶ '+h.name,h.x+h.w/2,h.y-16); }
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/26);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,5,5);ctx.globalAlpha=1;});
    rings.forEach(r=>{ctx.save();ctx.globalAlpha=Math.max(0,r.t/16);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.29);ctx.stroke();ctx.restore();r.r+=r.vr;r.t--;}); rings=rings.filter(r=>r.t>0);
    flashes.forEach(fl=>{ctx.save();ctx.globalAlpha=Math.max(0,fl.t/8)*.9;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(fl.x,fl.y,fl.r*(1.2-fl.t/16),0,6.29);ctx.fill();ctx.restore();fl.t--;}); flashes=flashes.filter(f=>f.t>0);
    pops.forEach(p=>{ctx.save();const s=1+(24-p.t)*.03;ctx.translate(p.x,p.y);ctx.scale(s,s);ctx.rotate(-.12);ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#000';ctx.strokeText(p.txt,0,0);ctx.fillStyle='#ffd23f';ctx.fillText(p.txt,0,0);ctx.restore();p.t--;p.y-=1.2;}); pops=pops.filter(p=>p.t>0);
    ctx.restore();
  }

  // ---- input wiring ----
  const hold=(el,k)=>{const s=v=>e=>{e.preventDefault();keys[k]=v;};el.addEventListener('touchstart',s(true),{passive:false});el.addEventListener('touchend',s(false),{passive:false});el.addEventListener('mousedown',s(true));el.addEventListener('mouseup',s(false));el.addEventListener('mouseleave',s(false));};
  const tap=(el,fn)=>{const h=e=>{e.preventDefault();fn();};el.addEventListener('touchstart',h,{passive:false});el.addEventListener('mousedown',h);};
  hold(bL,'left');hold(bR,'right');tap(bJ,jump);tap(bH,hit);
  const keyDown=e=>{if(e.key==='ArrowLeft')keys.left=true;if(e.key==='ArrowRight')keys.right=true;if(e.key===' '||e.key==='ArrowUp')jump();if(e.key.toLowerCase()==='x')hit();if(e.key==='Tab'){e.preventDefault();swap();}};
  const keyUp=e=>{if(e.key==='ArrowLeft')keys.left=false;if(e.key==='ArrowRight')keys.right=false;};
  const hudTap=()=>swap();
  addEventListener('keydown',keyDown); addEventListener('keyup',keyUp); hud.addEventListener('click',hudTap);

  let raf;
  function loop(){ update(); if(state!=='select')draw();
    if(state==='play'){const h=cur();const th=team.filter(t=>!t.dead).length,fh=foes.filter(f=>!f.dead).length;
      hud.textContent=(h?'❤️'.repeat(Math.max(0,h.hp))+' '+h.name:'')+'  ⭐'+score+'  '+T.stage+' '+level+'/'+totalLevels+'  💚'+th+' '+T.vs+' ❤️'+fh+(team.length>1?'  '+T.tapSwap:'');}
    else hud.textContent='';
    raf=requestAnimationFrame(loop);
  }

  return {
    start(){ showSelect(); loop(); },
    destroy(){ cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown',keyDown); removeEventListener('keyup',keyUp); mount.innerHTML=''; }
  };
}
