// rps.js — Rock-Paper-Scissors game engine (ES module)
// Interface: export function createGame(spec, assets, mount) -> { start(), destroy() }

const STR = {
  he: {
    rock: 'אבן', paper: 'נייר', scissors: 'מספריים',
    you: 'את/ה', cpu: 'מחשב', round: 'סיבוב',
    win: 'ניצחת! 🎉', lose: 'המחשב ניצח 😅', tie: 'תיקו! 🤝',
    roundWin: 'ניצחת בסיבוב!', roundLose: 'הפסדת בסיבוב', roundTie: 'תיקו בסיבוב',
    playAgain: 'שחק שוב', pick: 'בחר/י מה לשחק!', go: 'קדימה!',
  },
  en: {
    rock: 'Rock', paper: 'Paper', scissors: 'Scissors',
    you: 'You', cpu: 'CPU', round: 'Round',
    win: 'You Win! 🎉', lose: 'CPU Wins 😅', tie: "It's a Tie! 🤝",
    roundWin: 'You won the round!', roundLose: 'You lost the round', roundTie: 'Round tied',
    playAgain: 'Play Again', pick: 'Pick your move!', go: 'Go!',
  },
};

const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
const MOVES = ['rock', 'paper', 'scissors'];
// beats[a] = the move that a defeats
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function createGame(spec, assets, mount) {
  const lang = spec && spec.language === 'en' ? 'en' : 'he';
  const t = STR[lang];
  const rtl = lang === 'he';
  const rounds = Math.max(1, (spec && spec.levels) || 3);
  const title = (spec && spec.title) || (lang === 'he' ? 'אבן נייר ומספריים' : 'Rock Paper Scissors');

  let root, styleEl, timers = [], destroyed = false;
  let scoreYou = 0, scoreCpu = 0, roundNum = 0, busy = false;

  function schedule(fn, ms) {
    const id = setTimeout(() => {
      if (!destroyed) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function css() {
    const s = document.createElement('style');
    s.textContent = `
      .rps-root{position:relative;width:100%;height:100%;min-height:100%;box-sizing:border-box;
        display:flex;flex-direction:column;align-items:center;overflow:hidden;
        font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;
        background:radial-gradient(circle at 50% 0%,#3a2b6e,#1a1030 70%);color:#fff;
        direction:${rtl ? 'rtl' : 'ltr'};padding:12px;gap:10px;user-select:none;-webkit-tap-highlight-color:transparent;}
      .rps-title{font-size:clamp(20px,6vw,34px);font-weight:900;margin:4px 0;text-align:center;
        text-shadow:0 3px 0 #00000055;background:linear-gradient(90deg,#ffd166,#ff6b9d,#54e6ff);
        -webkit-background-clip:text;background-clip:text;color:transparent;}
      .rps-score{display:flex;gap:14px;align-items:center;font-size:clamp(16px,4vw,22px);font-weight:800;}
      .rps-score .box{background:#ffffff18;padding:6px 16px;border-radius:14px;min-width:60px;text-align:center;}
      .rps-score .you{box-shadow:inset 0 0 0 2px #54e6ff;}
      .rps-score .cpu{box-shadow:inset 0 0 0 2px #ff6b9d;}
      .rps-round{font-size:clamp(14px,3.5vw,18px);opacity:.85;font-weight:700;}
      .rps-arena{flex:1;display:flex;align-items:center;justify-content:center;gap:6vw;width:100%;
        min-height:120px;position:relative;}
      .rps-hand{font-size:clamp(52px,18vw,120px);line-height:1;filter:drop-shadow(0 6px 10px #0007);
        transition:transform .15s;}
      .rps-hand.you{transform:scaleX(${rtl ? 1 : -1});}
      .rps-hand.cpu{transform:scaleX(${rtl ? -1 : 1});}
      .rps-shake{animation:rps-shake .4s infinite;}
      @keyframes rps-shake{0%,100%{transform:translateY(0) var(--flip,scaleX(1));}
        50%{transform:translateY(-18px) var(--flip,scaleX(1));}}
      .rps-pop{animation:rps-pop .45s cubic-bezier(.2,1.6,.5,1);}
      @keyframes rps-pop{0%{transform:scale(.4);}70%{transform:scale(1.25);}100%{transform:scale(1);}}
      .rps-count{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        font-size:clamp(60px,22vw,140px);font-weight:900;color:#ffd166;text-shadow:0 4px 0 #0007;
        animation:rps-count .8s ease-out;pointer-events:none;}
      @keyframes rps-count{0%{transform:translate(-50%,-50%) scale(.3);opacity:0;}
        30%{opacity:1;}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0;}}
      .rps-msg{min-height:34px;font-size:clamp(18px,5vw,28px);font-weight:900;text-align:center;}
      .rps-buttons{display:flex;gap:12px;width:100%;max-width:520px;justify-content:center;
        padding-bottom:6px;flex-wrap:wrap;}
      .rps-btn{flex:1 1 90px;min-width:90px;max-width:150px;aspect-ratio:1/1;border:none;border-radius:24px;
        background:linear-gradient(160deg,#ffffff22,#ffffff08);box-shadow:0 6px 0 #00000055,inset 0 0 0 2px #ffffff30;
        color:#fff;font-size:clamp(34px,10vw,56px);cursor:pointer;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:2px;transition:transform .08s;touch-action:manipulation;}
      .rps-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #00000055,inset 0 0 0 2px #ffffff30;}
      .rps-btn .lbl{font-size:clamp(11px,3vw,15px);font-weight:800;opacity:.9;}
      .rps-btn:disabled{opacity:.4;cursor:default;}
      .rps-over{position:absolute;inset:0;background:#0d0820ee;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:18px;z-index:5;padding:20px;text-align:center;}
      .rps-over h2{font-size:clamp(30px,9vw,52px);margin:0;font-weight:900;}
      .rps-again{border:none;border-radius:20px;padding:16px 32px;font-size:clamp(18px,5vw,26px);
        font-weight:900;color:#1a1030;cursor:pointer;background:linear-gradient(90deg,#ffd166,#54e6ff);
        box-shadow:0 6px 0 #0006;touch-action:manipulation;}
      .rps-again:active{transform:translateY(3px);box-shadow:0 3px 0 #0006;}
      .rps-confetti{position:absolute;top:-20px;width:12px;height:12px;border-radius:3px;z-index:6;
        animation:rps-fall linear forwards;}
      @keyframes rps-fall{to{transform:translateY(110vh) rotate(720deg);opacity:.9;}}
    `;
    return s;
  }

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  let handYou, handCpu, msgEl, arena, btns = [], scoreYouEl, scoreCpuEl, roundEl;

  function build() {
    root = el('div', 'rps-root');
    root.appendChild(el('div', 'rps-title', title));

    const score = el('div', 'rps-score');
    const youBox = el('div', 'box you');
    scoreYouEl = el('span', null, '0');
    youBox.append(el('div', null, t.you), scoreYouEl);
    const cpuBox = el('div', 'box cpu');
    scoreCpuEl = el('span', null, '0');
    cpuBox.append(el('div', null, t.cpu), scoreCpuEl);
    score.append(youBox, cpuBox);
    root.appendChild(score);

    roundEl = el('div', 'rps-round', `${t.round} 1 / ${rounds}`);
    root.appendChild(roundEl);

    arena = el('div', 'rps-arena');
    handYou = el('div', 'rps-hand you', EMOJI.rock);
    handCpu = el('div', 'rps-hand cpu', EMOJI.rock);
    arena.append(handYou, handCpu);
    root.appendChild(arena);

    msgEl = el('div', 'rps-msg', t.pick);
    root.appendChild(msgEl);

    const bwrap = el('div', 'rps-buttons');
    btns = MOVES.map((m) => {
      const b = el('button', 'rps-btn');
      b.append(el('span', 'emoji', EMOJI[m]), el('span', 'lbl', t[m]));
      b.addEventListener('click', () => play(m));
      bwrap.appendChild(b);
      return b;
    });
    root.appendChild(bwrap);

    styleEl = css();
    mount.innerHTML = '';
    mount.appendChild(styleEl);
    mount.appendChild(root);
  }

  function setButtons(enabled) {
    btns.forEach((b) => (b.disabled = !enabled));
  }

  function play(youMove) {
    if (busy || destroyed) return;
    busy = true;
    setButtons(false);
    const cpuMove = MOVES[Math.floor(Math.random() * 3)];
    msgEl.textContent = '';
    handYou.textContent = EMOJI.rock;
    handCpu.textContent = EMOJI.rock;
    handYou.style.setProperty('--flip', rtl ? 'scaleX(1)' : 'scaleX(-1)');
    handCpu.style.setProperty('--flip', rtl ? 'scaleX(-1)' : 'scaleX(1)');
    handYou.classList.add('rps-shake');
    handCpu.classList.add('rps-shake');

    let n = 3;
    const tick = () => {
      if (n > 0) {
        showCount(String(n));
        n--;
        schedule(tick, 800);
      } else {
        reveal(youMove, cpuMove);
      }
    };
    tick();
  }

  function showCount(txt) {
    const c = el('div', 'rps-count', txt);
    arena.appendChild(c);
    schedule(() => c.remove(), 800);
  }

  function reveal(youMove, cpuMove) {
    handYou.classList.remove('rps-shake');
    handCpu.classList.remove('rps-shake');
    handYou.textContent = EMOJI[youMove];
    handCpu.textContent = EMOJI[cpuMove];
    handYou.classList.remove('rps-pop');
    handCpu.classList.remove('rps-pop');
    void handYou.offsetWidth; // reflow to restart animation
    handYou.classList.add('rps-pop');
    handCpu.classList.add('rps-pop');

    let outcome;
    if (youMove === cpuMove) {
      outcome = 'tie';
      msgEl.textContent = t.roundTie;
    } else if (BEATS[youMove] === cpuMove) {
      outcome = 'win';
      scoreYou++;
      scoreYouEl.textContent = String(scoreYou);
      msgEl.textContent = t.roundWin;
    } else {
      outcome = 'lose';
      scoreCpu++;
      scoreCpuEl.textContent = String(scoreCpu);
      msgEl.textContent = t.roundLose;
    }

    if (outcome !== 'tie') roundNum++;

    schedule(() => {
      busy = false;
      if (roundNum >= rounds || scoreYou > rounds / 2 || scoreCpu > rounds / 2) {
        gameOver();
      } else {
        roundEl.textContent = `${t.round} ${roundNum + 1} / ${rounds}`;
        msgEl.textContent = t.pick;
        setButtons(true);
      }
    }, 1100);
  }

  function gameOver() {
    const over = el('div', 'rps-over');
    let head;
    if (scoreYou > scoreCpu) head = t.win;
    else if (scoreCpu > scoreYou) head = t.lose;
    else head = t.tie;
    over.appendChild(el('h2', null, head));
    over.appendChild(el('div', 'rps-round', `${scoreYou} : ${scoreCpu}`));
    const again = el('button', 'rps-again', t.playAgain);
    again.addEventListener('click', () => {
      over.remove();
      resetGame();
    });
    over.appendChild(again);
    root.appendChild(over);
    if (scoreYou >= scoreCpu) confetti();
  }

  function confetti() {
    const colors = ['#ffd166', '#ff6b9d', '#54e6ff', '#8affc1', '#c77dff'];
    for (let i = 0; i < 40; i++) {
      const c = el('div', 'rps-confetti');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.5 + Math.random() * 1.5 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      root.appendChild(c);
      schedule(() => c.remove(), 3500);
    }
  }

  function resetGame() {
    scoreYou = 0;
    scoreCpu = 0;
    roundNum = 0;
    busy = false;
    scoreYouEl.textContent = '0';
    scoreCpuEl.textContent = '0';
    roundEl.textContent = `${t.round} 1 / ${rounds}`;
    msgEl.textContent = t.pick;
    handYou.textContent = EMOJI.rock;
    handCpu.textContent = EMOJI.rock;
    setButtons(true);
  }

  return {
    start() {
      if (destroyed) return;
      build();
      setButtons(true);
    },
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      timers = [];
      if (mount) mount.innerHTML = '';
      root = styleEl = null;
    },
  };
}
