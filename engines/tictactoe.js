// tictactoe.js — self-contained Tic-Tac-Toe engine for the Kidmaker kids platform.
// Interface: export function createGame(spec, assets, mount) -> { start(){}, destroy(){} }

export function createGame(spec = {}, assets = {}, mount) {
  const lang = spec.language === 'he' ? 'he' : 'en';
  const rtl = lang === 'he';
  const rounds = Math.max(1, parseInt(spec.levels, 10) || 3);

  const T = {
    he: {
      title: spec.title || 'איקס עיגול',
      turn: (p) => `תור שחקן ${p}`,
      win: (p) => `שחקן ${p} ניצח בסיבוב! 🎉`,
      draw: 'תיקו! 🤝',
      round: (n) => `סיבוב ${n} מתוך ${rounds}`,
      score: 'ניקוד',
      champ: (p) => `🏆 שחקן ${p} אלוף!`,
      tie: '🤝 תיקו כללי!',
      again: 'שחקו שוב',
      next: 'הסיבוב הבא',
    },
    en: {
      title: spec.title || 'Tic-Tac-Toe',
      turn: (p) => `Player ${p}'s turn`,
      win: (p) => `Player ${p} wins the round! 🎉`,
      draw: "It's a draw! 🤝",
      round: (n) => `Round ${n} of ${rounds}`,
      score: 'Score',
      champ: (p) => `🏆 Player ${p} is champion!`,
      tie: '🤝 Overall tie!',
      again: 'Play again',
      next: 'Next round',
    },
  }[lang];

  // Two player marks: use image assets if exactly 2 provided, else X / O glyphs.
  const assetKeys = Object.keys(assets || {});
  const useImgs = assetKeys.length >= 2;
  const marks = useImgs ? [assets[assetKeys[0]], assets[assetKeys[1]]] : ['✕', '◯'];
  const markColors = ['#ff5d8f', '#39d0ff'];

  // ---- state ----
  let board, current, roundNo, scores, winLine, over, matchOver;
  let el = {}; // dom refs
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  const WINS = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6],         // diags
  ];

  function resetMatch() {
    scores = [0, 0];
    roundNo = 1;
    resetRound();
  }
  function resetRound() {
    board = Array(9).fill(-1);
    current = 0;
    winLine = null;
    over = false;
    matchOver = false;
  }

  function checkWin() {
    for (const line of WINS) {
      const [a, b, c] = line;
      if (board[a] !== -1 && board[a] === board[b] && board[a] === board[c]) {
        return { player: board[a], line };
      }
    }
    return board.every((v) => v !== -1) ? { player: -1, line: null } : null;
  }

  // ---- rendering ----
  function css() {
    return `
      .ttt-root{position:absolute;inset:0;display:flex;flex-direction:column;
        font-family:'Baloo 2','Comic Sans MS',system-ui,sans-serif;
        background:radial-gradient(circle at 50% 0%,#3a2a6e,#151030 70%);
        color:#fff;overflow:hidden;direction:${rtl ? 'rtl' : 'ltr'};
        -webkit-tap-highlight-color:transparent;user-select:none;box-sizing:border-box;}
      .ttt-root *{box-sizing:border-box;}
      .ttt-title{text-align:center;font-size:clamp(24px,7vw,52px);font-weight:800;
        padding:12px 8px 4px;color:#ffe36e;text-shadow:0 3px 0 rgba(0,0,0,.35);}
      .ttt-info{text-align:center;font-size:clamp(15px,4.5vw,26px);min-height:1.4em;
        padding:2px 8px;font-weight:700;}
      .ttt-score{display:flex;justify-content:center;gap:14px;padding:6px;
        font-size:clamp(15px,4.5vw,24px);font-weight:800;}
      .ttt-score .p{padding:6px 16px;border-radius:16px;background:rgba(255,255,255,.08);}
      .ttt-score .p0{box-shadow:inset 0 0 0 3px #ff5d8f;}
      .ttt-score .p1{box-shadow:inset 0 0 0 3px #39d0ff;}
      .ttt-active{transform:scale(1.08);}
      .ttt-boardwrap{flex:1;display:flex;align-items:center;justify-content:center;padding:10px;min-height:0;}
      .ttt-board{width:min(92vw,min(70vh,520px));aspect-ratio:1/1;display:grid;
        grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:min(3vw,16px);}
      .ttt-cell{border:none;border-radius:18px;background:linear-gradient(145deg,#2c2358,#211a45);
        box-shadow:0 6px 0 rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
        font-size:min(18vw,110px);font-weight:900;line-height:1;cursor:pointer;color:#fff;
        transition:transform .08s;overflow:hidden;padding:0;}
      .ttt-cell:active{transform:translateY(3px);box-shadow:0 3px 0 rgba(0,0,0,.35);}
      .ttt-cell img{width:70%;height:70%;object-fit:contain;}
      .ttt-mark{display:inline-block;animation:pop .25s cubic-bezier(.2,1.5,.4,1);}
      .ttt-cell.win{background:linear-gradient(145deg,#ffd93d,#ffb02e);color:#2b1a00;}
      @keyframes pop{0%{transform:scale(0)}100%{transform:scale(1)}}
      .ttt-overlay{position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:22px;background:rgba(10,6,30,.82);
        text-align:center;padding:20px;animation:fade .3s ease;}
      @keyframes fade{from{opacity:0}to{opacity:1}}
      .ttt-big{font-size:clamp(28px,9vw,64px);font-weight:900;color:#ffe36e;
        text-shadow:0 4px 0 rgba(0,0,0,.4);}
      .ttt-btn{border:none;border-radius:30px;padding:16px 34px;font-size:clamp(18px,5.5vw,30px);
        font-weight:800;color:#20143f;cursor:pointer;font-family:inherit;
        background:linear-gradient(145deg,#7dffb0,#2fd980);box-shadow:0 6px 0 #1a9c58;}
      .ttt-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #1a9c58;}
    `;
  }

  function markHTML(player) {
    if (useImgs) return `<img class="ttt-mark" src="${marks[player]}" alt="">`;
    return `<span class="ttt-mark" style="color:${markColors[player]}">${marks[player]}</span>`;
  }

  function render() {
    mount.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'ttt-root';
    const style = document.createElement('style');
    style.textContent = css();
    root.appendChild(style);

    root.insertAdjacentHTML('beforeend', `
      <div class="ttt-title">${T.title}</div>
      <div class="ttt-info" id="ttt-info"></div>
      <div class="ttt-score">
        <div class="p p0" id="ttt-s0">${playerLabel(0)}: <span>0</span></div>
        <div class="p p1" id="ttt-s1">${playerLabel(1)}: <span>0</span></div>
      </div>
      <div class="ttt-boardwrap"><div class="ttt-board" id="ttt-board"></div></div>
    `);
    mount.appendChild(root);

    el.root = root;
    el.info = root.querySelector('#ttt-info');
    el.board = root.querySelector('#ttt-board');
    el.s0 = root.querySelector('#ttt-s0');
    el.s1 = root.querySelector('#ttt-s1');

    for (let i = 0; i < 9; i++) {
      const c = document.createElement('button');
      c.className = 'ttt-cell';
      c.dataset.i = i;
      c.addEventListener('click', onCell);
      el.board.appendChild(c);
    }
    drawBoard();
    updateInfo();
  }

  function playerLabel(p) {
    return useImgs ? '' : (lang === 'he' ? `שחקן ${p + 1}` : `P${p + 1}`);
  }

  function drawBoard() {
    const cells = el.board.children;
    for (let i = 0; i < 9; i++) {
      const c = cells[i];
      const has = board[i] !== -1;
      c.innerHTML = has ? markHTML(board[i]) : '';
      c.classList.toggle('win', !!(winLine && winLine.includes(i)));
      c.disabled = has || over;
    }
  }

  function updateScores() {
    el.s0.querySelector('span').textContent = scores[0];
    el.s1.querySelector('span').textContent = scores[1];
    el.s0.classList.toggle('ttt-active', current === 0 && !over);
    el.s1.classList.toggle('ttt-active', current === 1 && !over);
  }

  function updateInfo() {
    el.info.textContent = `${T.round(roundNo)} — ${T.turn(current + 1)}`;
    updateScores();
  }

  function onCell(e) {
    if (over) return;
    const i = +e.currentTarget.dataset.i;
    if (board[i] !== -1) return;
    board[i] = current;
    drawBoard();

    const result = checkWin();
    if (result) {
      over = true;
      if (result.player !== -1) {
        scores[result.player]++;
        winLine = result.line;
      }
      drawBoard();
      updateScores();
      const msg = result.player === -1 ? T.draw : T.win(result.player + 1);
      el.info.textContent = msg;
      later(endOfRound, 1100);
    } else {
      current = 1 - current;
      updateInfo();
    }
  }

  function endOfRound() {
    if (roundNo >= rounds) return showMatchEnd();
    roundNo++;
    const prev = current;
    resetRoundKeepScore();
    current = 1 - prev; // loser/next starts
    drawBoard();
    updateInfo();
  }

  function resetRoundKeepScore() {
    board = Array(9).fill(-1);
    winLine = null;
    over = false;
  }

  function showMatchEnd() {
    matchOver = true;
    const ov = document.createElement('div');
    ov.className = 'ttt-overlay';
    let msg;
    if (scores[0] === scores[1]) msg = T.tie;
    else msg = T.champ((scores[0] > scores[1] ? 0 : 1) + 1);
    ov.innerHTML = `
      <div class="ttt-big">${msg}</div>
      <div class="ttt-info">${T.score}: ${scores[0]} - ${scores[1]}</div>
      <button class="ttt-btn" id="ttt-again">${T.again}</button>
    `;
    el.root.appendChild(ov);
    el.overlay = ov;
    ov.querySelector('#ttt-again').addEventListener('click', () => {
      ov.remove();
      el.overlay = null;
      resetMatch();
      drawBoard();
      updateInfo();
    });
  }

  return {
    start() {
      if (!mount) throw new Error('tictactoe: mount element required');
      resetMatch();
      render();
    },
    destroy() {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      if (mount) mount.innerHTML = '';
      el = {};
    },
  };
}
