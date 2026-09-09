// Career orchestration: the layer between the circuit engine and the game.
//
// The engine (circuit.js) knows about ratings and brackets, the press desk
// (news.js) knows about copy, and this knows about the *game* — it starts the
// battles, reads what happened in them, heals between rounds and pays out.
// Keeping it here rather than in the UI means tools/circuittest.mjs can run a
// whole season without a canvas.
import {
  enterTournament, currentOpponent, currentRoundName, activeTournament,
  resolveRound, finishTournament, abandonTournament, recordLinkResult,
  simulateSeasonWeek, proAsTrainer, canEnter, currentRank,
} from './circuit.js';
import {
  reportDebut, reportDraw, reportMatch, reportTournamentResult, reportLinkResult,
  reportPowerRankings, reportSeasonWeek, buildPress, answerPress,
} from './news.js';
import { getTournament } from '../../data/circuit.js';
import { makeRng } from '../../core/rng.js';
import { displayName, healFully, isFainted, maxHp } from '../monster.js';
import { addItem } from '../inventory.js';

/** Pulls the reportable facts out of a finished battle. */
export function battleDetail(battle, playerSideId = 'player') {
  if (!battle) return {};
  const [sa, sb] = battle.sides;
  const me = sa.id === playerSideId ? sa : sb;
  const foe = me === sa ? sb : sa;
  const alive = (s) => s.party.filter((m) => !isFainted(m)).length;
  const best = me.party
    .filter((m) => !isFainted(m))
    .sort((x, y) => (y.hp / maxHp(y)) - (x.hp / maxHp(x)))[0] || me.party[0];
  return {
    survivors: alive(me),
    oppSurvivors: alive(foe),
    turns: battle.turn || 0,
    star: best ? displayName(best) : null,
  };
}

export class Career {
  constructor(game) {
    this.game = game;
  }

  get c() { return this.game.state.circuit; }
  // The unanswered press question lives in the save, not on this object, so
  // quitting after a final and coming back still owes you a podium interview.
  get pendingPress() { return this.c.lastPress || null; }
  set pendingPress(v) { this.c.lastPress = v || null; }
  get playerName() { return this.game.state.player.name; }

  /** First contact with the circuit desk. */
  join() {
    const c = this.c;
    if (c.joined) return false;
    c.joined = true;
    return true;
  }

  rank() { return currentRank(this.c); }
  gateFor(t) { return canEnter(this.c, t); }
  activeTournament() { return activeTournament(this.c); }
  opponent() { return currentOpponent(this.c); }
  roundName() { return currentRoundName(this.c); }

  /** Signs up and draws the bracket. Returns the run, or null if gated. */
  enter(tournamentId) {
    const c = this.c;
    const t = getTournament(tournamentId);
    if (!t) return null;
    const first = !c.entered.length;
    const run = enterTournament(c, tournamentId);
    if (!run) return null;
    if (first) reportDebut(c, this.playerName, t);
    reportDraw(c, this.playerName, t, run);
    return run;
  }

  /**
   * Starts the current round's battle. `onDone(won)` fires after the fade,
   * once the result has been recorded and the press has filed.
   */
  startRound(onDone) {
    const c = this.c;
    const t = activeTournament(c);
    const pro = currentOpponent(c);
    if (!t || !pro) return false;
    const rng = makeRng((c.seed ^ 0x9e3779b9) >>> 0);
    const trainer = proAsTrainer(pro, t.level, rng, currentRoundName(c));
    const screen = this.game.startTrainerBattle(trainer, null, {
      noBlackout: true,
      circuit: true,
      onFinish: (won) => {
        const detail = battleDetail(screen ? screen.battle : null);
        this.recordRound(won, detail);
        if (onDone) onDone(won);
      },
    });
    return true;
  }

  /** Records a round result and files the story. */
  recordRound(won, detail = {}) {
    const c = this.c;
    const t = activeTournament(c);
    const entry = resolveRound(c, won, detail);
    if (entry && t) reportMatch(c, this.playerName, t, entry);
    return entry;
  }

  /** True once the run is over one way or the other. */
  runFinished() { return !!this.c.active && this.c.active.done; }

  /**
   * Closes the run: points, prize money, promotion, the press conference and
   * the week of pro results that happens whether or not you were watching.
   */
  settle() {
    const c = this.c;
    if (!c.active) return null;
    const summary = finishTournament(c);
    if (!summary) return null;
    reportTournamentResult(c, this.playerName, summary);
    if (summary.prize > 0) {
      this.game.state.inventory.money = Math.min(999999,
        this.game.state.inventory.money + summary.prize);
    }
    if (summary.won) {
      // A title always comes with something you can hold.
      addItem(this.game.state.inventory, 'maxrevive', 1);
      addItem(this.game.state.inventory, 'fullheal', 2);
    }
    reportSeasonWeek(c, simulateSeasonWeek(c), this.playerName);
    reportPowerRankings(c, this.playerName);
    c.lastPress = buildPress(c, this.playerName, summary);
    this.game.save.markDirty();
    return summary;
  }

  /** Applies a press-conference answer. */
  answerPress(index) {
    const res = answerPress(this.c, this.playerName, this.pendingPress, index);
    this.c.lastPress = null;
    this.game.save.markDirty();
    return res;
  }

  /** Withdrawing mid-event. Costs rating, as it should. */
  withdraw() {
    abandonTournament(this.c);
    this.game.save.markDirty();
  }

  /** Full heal between rounds — tournaments provide medical staff. */
  healBetweenRounds() {
    for (const m of this.game.state.party) healFully(m);
  }

  /** A finished link battle against the other human counts for the ranking. */
  recordLink(won, opponentName) {
    const c = this.c;
    if (!c.joined) return null;
    const res = recordLinkResult(c, won, opponentName || 'a linked trainer');
    reportLinkResult(c, this.playerName, res);
    this.game.save.markDirty();
    return res;
  }
}
