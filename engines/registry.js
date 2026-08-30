// Engine registry — maps spec.genre -> engine factory.
// Every engine: createGame(spec, assets, mount) -> { start(), destroy() }
import { createGame as brawler }  from './brawler.js';
import { createGame as tictactoe } from './tictactoe.js';
import { createGame as rps }       from './rps.js';
import { createGame as racer }     from './racer.js';

export const ENGINES = {
  brawler,
  tictactoe,
  rps,
  racer,
  // aliases / not-yet-built genres fall back to a sensible engine
  board: brawler,      // TODO: real chess/board engine
  collector: racer,    // TODO: real collector engine
};
