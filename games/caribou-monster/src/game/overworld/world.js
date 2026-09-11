// The overworld simulation.
//
// Grid-based like the games it is modelled on: an entity always occupies a
// whole tile and animates between tiles. Everything downstream — collision,
// encounters, trainer sight, the camera — is simple and predictable because
// of that, and it is what makes the movement feel right rather than floaty.
import { getMap } from '../../data/maps/index.js';
import { onWalked } from '../friendship.js';
import { walk as daycareWalk } from '../daycare.js';
import { isCleared, canUse } from '../fieldmoves.js';
import { tileDef } from '../../render/tiles.js';
import { getTrainer } from '../../data/trainers.js';
import { weightedPick } from '../../core/rng.js';
import { TILE } from '../../render/canvas.js';
import { currentPhase } from '../clock.js';
import { buddyPlayerOf } from '../players.js';

export const WALK_FRAMES = 14;    // logic ticks to cross one tile
export const RUN_FRAMES = 8;
export const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
export const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };

let entityId = 1;

export function makeEntity(cfg) {
  return {
    id: cfg.id || `e${entityId++}`,
    kind: cfg.kind || 'npc',       // player | npc | remote
    x: cfg.x, y: cfg.y,
    dir: cfg.dir || cfg.facing || 'down',
    look: cfg.look || 'youngster',
    name: cfg.name || null,
    moving: false,
    moveT: 0,
    moveDur: WALK_FRAMES,
    fromX: cfg.x, fromY: cfg.y,
    frame: 0,
    stepPhase: 0,
    solid: cfg.solid !== false,
    data: cfg,
    // NPC behaviour
    movement: cfg.movement || 'still',
    homeX: cfg.x, homeY: cfg.y,
    think: 40 + Math.floor(Math.random() * 90),
    visible: true,
    hopping: 0,
    alpha: 1,
  };
}

export class World {
  constructor(state) {
    this.state = state;
    this.map = null;
    this.mapId = null;
    this.entities = [];
    this.player = null;
    this.remotes = new Map();       // peer -> entity
    this.animFrame = 0;
    this.animTimer = 0;
    this.encounterCooldown = 0;
    this.pendingEncounter = null;
    this.pendingLadder = null;
    this.pendingWarp = null;
    this.pendingBlocked = null;
    this.pendingTrainer = null;
    this.pendingEvent = null;
    this.stepsSinceEncounter = 0;
    this.busy = false;              // a screen above is handling something
    this.onStep = null;
  }

  // ---- map loading -------------------------------------------------------

  load(mapId, x, y, dir = 'down') {
    this.map = getMap(mapId);
    this.mapId = mapId;
    this.entities = [];
    this.remotes.clear();

    this.player = makeEntity({ id: 'player', kind: 'player', x, y, dir, look: this.state.player.look });
    this.entities.push(this.player);

    // The lead Pokemon walks behind you, the way it does in HeartGold. It is
    // a rendering companion, not a body: it never blocks anything, is never
    // in a collision test, and is rebuilt from the party on every map load,
    // so nothing about it can desync a save or a link session.
    this.follower = makeEntity({
      id: 'follower', kind: 'follower', x, y, dir, look: null, solid: false,
    });
    this.follower.trail = [];
    this.refreshFollower();

    // The walking companion: a *person* who comes with you.
    //
    // Deliberately a generic slot rather than "the other protagonist". Most
    // of the time it is Sammy or Matthew, but the story wants Looker to
    // escort you across a city and Riley to walk you out of a mine, and
    // neither of those should need its own machinery. Like the Pokemon
    // follower it is a rendering body, never in a collision test, so it can
    // never wedge the player against scenery or desync a link.
    this.companion = makeEntity({
      id: 'companion', kind: 'companion', x, y, dir, look: null, solid: false,
    });
    this.companion.trail = [];
    this.refreshCompanion();

    // A second walking body, for an animal that belongs to the companion
    // rather than to you.
    //
    // Bandit is Sammy's dog. When Sammy is the one holding the phone she is
    // in Sammy's party and the Pokemon follower draws her. When MATTHEW is
    // holding the phone, Sammy is a companion and Bandit is nobody's party
    // member — so without this she simply was not there, while every NPC in
    // Twinleaf carried on talking about her.
    this.pet = makeEntity({
      id: 'pet', kind: 'companion', x, y, dir, look: null, solid: false,
    });
    this.pet.trail = [];
    this.pet.isPet = true;
    this.refreshPet();

    for (const npc of this.map.npcs) {
      if (npc.trainer && this.state.flags[`beat_${npc.trainer}`] && npc.removeAfter) continue;
      // Two general switches, so a scene can put somebody in the road and
      // then take them out of it without the map needing two copies.
      // `goneWhen` is somebody who leaves; `onlyWhen` is somebody who
      // has not turned up yet.
      if (npc.goneWhen && this.state.flags[npc.goneWhen]) continue;
      if (npc.onlyWhen && !this.state.flags[npc.onlyWhen]) continue;
      // The other protagonist. When the link is up they are a real player
      // walking around, so the stand-in has to get out of the way; when it
      // is not, they are here, because they live here.
      if (npc.soloOnly && this.linkedNow()) continue;
      // And a stand-in has to look like whoever you are NOT playing.
      const look = npc.look === 'buddy' ? buddyPlayerOf(this.state).look : npc.look;
      const e = makeEntity({ ...npc, look, kind: 'npc' });
      // An NPC that is a Pokemon rather than a person — the Psyduck sitting
      // in the fog road. It draws from the same artwork the walking partner
      // uses, so there is no second sprite pipeline to keep in step.
      if (npc.species) e.mon = { species: npc.species, shiny: false };
      this.entities.push(e);
    }
    for (const obj of this.map.objects) {
      if (this.state.flags[`item_${obj.id}`]) continue;
      this.entities.push(makeEntity({
        ...obj, kind: 'item', look: null, movement: 'still', solid: true,
      }));
    }
    this.state.player.map = mapId;
    this.state.player.x = x;
    this.state.player.y = y;
    this.state.player.dir = dir;
    // The Town Map only shows what you have actually walked into.
    if (this.state.visited) this.state.visited[mapId] = true;
  }

  // ---- queries -------------------------------------------------------------

  /**
   * The tile as the game currently sees it.
   *
   * A tree the player has cut down is not a tree any more, and saying so here
   * rather than in the collision code means the renderer, the pathing, the
   * audit and everything else agree about it for free.
   */
  tileAt(x, y) {
    if (!this.map) return ' ';
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return ' ';
    const ch = this.map.tiles[y][x];
    const def = tileDef(ch);
    if (def.field && isCleared(this.state, this.mapId, x, y)) {
      return this.map.kind === 'cave' && def.clearsTo === '.' ? 'c' : def.clearsTo;
    }
    return ch;
  }

  /** The tile as the map author wrote it, obstacles and all. */
  rawTileAt(x, y) {
    if (!this.map) return ' ';
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return ' ';
    return this.map.tiles[y][x];
  }

  defAt(x, y) { return tileDef(this.tileAt(x, y)); }

  entityAt(x, y, ignore = null) {
    for (const e of this.entities) {
      if (e === ignore || !e.visible || !e.solid) continue;
      if (e.x === x && e.y === y) return e;
      // An entity mid-step occupies both tiles, so nobody walks through it.
      if (e.moving && e.fromX === x && e.fromY === y) return e;
    }
    return null;
  }

  remoteAt(x, y) {
    for (const e of this.remotes.values()) if (e.x === x && e.y === y) return e;
    return null;
  }

  warpAt(x, y) { return this.map.warps.find((w) => w.x === x && w.y === y) || null; }
  signAt(x, y) { return this.map.signs.find((s) => s.x === x && s.y === y) || null; }

  canEnter(entity, x, y, dirName) {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return false;
    const def = this.defAt(x, y);
    if (def.ledge) return dirName === def.ledge;    // ledges are one-way hops
    // Deep water is solid until somebody can carry you across it. Surf is the
    // one field move with no obstacle tile of its own: it does not clear
    // anything, it changes what counts as ground.
    if (def.water && !def.field && entity.kind === 'player' && canUse(this.state, 'surf')) return true;
    // A door the story has not opened yet. Treated as solid so the player
    // bumps it rather than stepping onto it and being pushed back off — a
    // shove is a worse feeling and a messier piece of code.
    if (entity.kind === 'player') {
      const w = this.warpAt(x, y);
      if (w && w.requires && !this.state.flags[w.requires]) return false;
    }
    if (def.solid) return false;
    if (this.entityAt(x, y, entity)) return false;
    if (entity.kind === 'player' && this.remoteAt(x, y)) return false;
    return true;
  }

  // ---- movement -------------------------------------------------------------

  startMove(entity, dirName, run = false) {
    if (entity.moving) return false;
    entity.dir = dirName;
    const [dx, dy] = DIRS[dirName];
    const nx = entity.x + dx, ny = entity.y + dy;
    if (!this.canEnter(entity, nx, ny, dirName)) {
      if (entity.kind === 'player') {
        const w = this.warpAt(nx, ny);
        if (w && w.requires && !this.state.flags[w.requires]) this.pendingBlocked = w;
      }
      return false;
    }

    const def = this.defAt(nx, ny);
    let tx = nx, ty = ny, hop = 0;
    if (def.ledge === dirName) {
      // Hop the ledge: land on the tile past it.
      const lx = nx + dx, ly = ny + dy;
      if (lx < 0 || ly < 0 || lx >= this.map.width || ly >= this.map.height) return false;
      if (this.defAt(lx, ly).solid || this.entityAt(lx, ly, entity)) return false;
      tx = lx; ty = ly; hop = 1;
    }

    entity.fromX = entity.x;
    entity.fromY = entity.y;
    entity.x = tx;
    entity.y = ty;
    entity.moving = true;
    entity.moveT = 0;
    entity.moveDur = (run ? RUN_FRAMES : WALK_FRAMES) * (hop ? 1.6 : 1);
    entity.hopping = hop;
    if (entity.kind === 'player') {
      const step = { x: entity.fromX, y: entity.fromY, dur: entity.moveDur, hop: 0 };
      // The person walks a tile behind you and the Pokemon a tile behind
      // them, so the three of you read as a line rather than a pile.
      if (this.companion && this.companion.visible) {
        this.companion.trail.push({ ...step });
        while (this.companion.trail.length > 2) this.companion.trail.shift();
      }
      if (this.follower && this.follower.visible) {
        this.follower.trail.push({ ...step });
        const slack = this.companion && this.companion.visible ? 3 : 2;
        while (this.follower.trail.length > slack) this.follower.trail.shift();
      }
      if (this.pet && this.pet.visible) {
        this.pet.trail.push({ ...step });
        // Behind the person she belongs to, and behind your Pokemon if you
        // have one out, so the line reads front to back in the right order.
        let slack = 2;
        if (this.companion && this.companion.visible) slack++;
        if (this.follower && this.follower.visible) slack++;
        while (this.pet.trail.length > slack) this.pet.trail.shift();
      }
    }
    return true;
  }

  face(entity, dirName) { if (!entity.moving) entity.dir = dirName; }

  // ---- the walking partner ---------------------------------------------------

  /**
   * Puts the companion where it belongs for this map.
   *
   * Hidden the moment a real second player is on the link: a stand-in walking
   * around while the person it stands in for is also on screen is the one
   * thing that would make co-op feel worse rather than better.
   */
  /**
   * Puts a walking body next to the player rather than on top of them.
   *
   * Everyone who joins you used to be folded onto the player's own tile so
   * they would not slide in from whatever corner the last map left them in.
   * The side effect was that they were invisible for the whole scene they had
   * turned up for: the player stood on the doorstep reading a conversation
   * with somebody who was standing exactly where the player was, and only saw
   * them once the scene ended and they took a step.
   *
   * So they go one tile BEHIND the player — where a follower belongs, and
   * where they will be a moment later anyway — and failing that, any free
   * tile beside them. Only if the player is boxed in do they end up folded in
   * as before, which at least keeps them from standing inside a wall.
   */
  /** Whichever of the companion, the dog or the partner is standing here. */
  _bodyAt(x, y, except = null) {
    for (const b of [this.companion, this.pet, this.follower]) {
      if (!b || b === except || !b.visible) continue;
      if (b.x === x && b.y === y) return b;
    }
    return null;
  }

  _placeBeside(body) {
    const p = this.player;
    const BEHIND = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
    const back = BEHIND[p.dir] || [0, 1];
    const tries = [back, [0, 1], [0, -1], [-1, 0], [1, 0]];
    let x = p.x, y = p.y;
    for (const [dx, dy] of tries) {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx < 0 || ny < 0 || nx >= this.map.width || ny >= this.map.height) continue;
      if (this.defAt(nx, ny).solid) continue;
      if (this.entityAt(nx, ny, body)) continue;
      // The other walking bodies do not block anybody — they are deliberately
      // not solid, so you never get shut in by your own dog — but two of them
      // on one tile is still one sprite hiding another.
      if (this._bodyAt(nx, ny, body)) continue;
      x = nx; y = ny; break;
    }
    body.x = x; body.y = y;
    body.fromX = x; body.fromY = y;
    body.dir = p.dir;
    body.moving = false;
    body.trail = [];
  }

  refreshCompanion() {
    const c = this.companion;
    if (!c) return;
    const slot = this.state.companion;
    c.visible = !!(slot && slot.active && slot.look) && !this.linkedNow();
    c.look = slot ? slot.look : null;
    c.name = slot ? slot.name : null;
    if (!c.visible) { c.trail = []; return; }
    this._placeBeside(c);
  }

  refreshPet() {
    const c = this.pet;
    if (!c) return;
    const slot = this.state.pet;
    // Bandit walks with whoever is holding the phone, because she is Sammy's
    // dog and Sammy is either the player or the person beside them. The one
    // case she must NOT be drawn is when she is already the lead Pokemon and
    // the party follower is drawing her — two Bandits is worse than none.
    const alreadyDrawn = !!(slot && this.follower && this.follower.visible
      && this.follower.mon && this.follower.mon.species === slot.species);
    c.visible = !!(slot && slot.active && slot.species) && !this.linkedNow() && !alreadyDrawn;
    c.species = slot ? slot.species : null;
    c.name = slot ? slot.name : null;
    if (!c.visible) { c.trail = []; return; }
    this._placeBeside(c);
  }

  /** An animal starts walking with you. `who` is {species, name}. */
  petJoin(who) {
    this.state.pet = { ...who, active: true };
    this.refreshPet();
  }

  petLeave() {
    if (this.state.pet) this.state.pet.active = false;
    this.refreshPet();
  }

  /** Somebody starts walking with you. `who` is {look, name, key}. */
  companionJoin(who) {
    this.state.companion = { ...who, active: true };
    this.refreshCompanion();
  }

  /** And stops. The slot remembers who it was, for a later rejoin. */
  companionLeave() {
    if (this.state.companion) this.state.companion.active = false;
    this.refreshCompanion();
    // The dog belongs to the person, so she goes when they do.
    this.petLeave();
  }

  /**
   * Reads the lead Pokemon off the party. Called on map load and whenever the
   * party changes, so swapping your lead swaps who is walking with you.
   */
  refreshFollower() {
    const f = this.follower;
    if (!f) return;
    // An Egg does not walk beside you, and a fainted one is in its ball.
    const lead = (this.state.party || []).find((m) => m && !m.isEgg && m.hp > 0) || null;
    f.mon = lead;
    f.visible = !!lead && this.map && this.map.kind !== 'indoor';
    if (!f.visible) return;
    this._placeBeside(f);
  }

  /**
   * One step of the follower: it walks into the tile the player has just
   * left. The trail is a queue of the player's last positions, so the partner
   * traces the player's path rather than cutting corners through walls.
   */
  _followerStep(which) {
    const f = which || this.follower;
    if (!f || !f.visible || f.moving) return;
    const next = f.trail.shift();
    if (!next) return;
    if (next.x === f.x && next.y === f.y) return;
    f.fromX = f.x; f.fromY = f.y;
    f.dir = next.x > f.x ? 'right' : next.x < f.x ? 'left' : next.y > f.y ? 'down' : 'up';
    f.x = next.x; f.y = next.y;
    f.moving = true;
    f.moveT = 0;
    f.moveDur = next.dur || WALK_FRAMES;
    f.hopping = next.hop || 0;
  }

  // Pixel position for rendering, interpolated across the step.
  renderPos(entity) {
    if (!entity.moving) return { x: entity.x * TILE, y: entity.y * TILE, lift: 0 };
    const t = Math.min(1, entity.moveT / entity.moveDur);
    const x = (entity.fromX + (entity.x - entity.fromX) * t) * TILE;
    const y = (entity.fromY + (entity.y - entity.fromY) * t) * TILE;
    const lift = entity.hopping ? Math.sin(t * Math.PI) * 10 : 0;
    return { x, y, lift };
  }

  // ---- update ---------------------------------------------------------------

  update(dt, allowPlayer, moveDir, running) {
    this.animTimer += dt;
    if (this.animTimer > 0.22) { this.animTimer -= 0.22; this.animFrame = (this.animFrame + 1) % 4; }
    if (this.encounterCooldown > 0) this.encounterCooldown--;

    // The people and the Pokemon walking behind you, first, so they are
    // already moving on the frame the player starts its step and the whole
    // line reads as one procession rather than three things twitching.
    for (const f of [this.companion, this.follower, this.pet]) {
      if (!f || !f.visible) continue;
      if (f.moving) {
        f.moveT++;
        f.frame = 1 + (Math.floor((f.moveT / f.moveDur) * 2) % 2);
        if (f.moveT >= f.moveDur) { f.moving = false; f.frame = 0; f.hopping = 0; }
      }
      if (!f.moving) this._followerStep(f);
    }

    // Player.
    const p = this.player;
    if (p.moving) {
      p.moveT++;
      // Step animation: two contact frames per tile.
      p.frame = 1 + (Math.floor((p.moveT / p.moveDur) * 2) % 2);
      if (p.moveT >= p.moveDur) this._finishPlayerStep();
    } else if (allowPlayer && moveDir) {
      // A brief "turn in place" beat before walking, like the DS games.
      if (p.dir !== moveDir && p.turnDelay == null) { p.dir = moveDir; p.turnDelay = 5; }
      else if (p.turnDelay > 0) p.turnDelay--;
      else {
        p.turnDelay = null;
        if (!this.startMove(p, moveDir, running)) {
          p.frame = 0;
          if (!p.bumpedAt || performance.now() - p.bumpedAt > 350) {
            p.bumpedAt = performance.now();
            if (this.onBump) this.onBump();
          }
        }
      }
    } else {
      p.frame = 0;
      p.turnDelay = null;
    }

    // NPCs.
    for (const e of this.entities) {
      if (e === p || e.kind === 'item') continue;
      if (e.moving) {
        e.moveT++;
        e.frame = 1 + (Math.floor((e.moveT / e.moveDur) * 2) % 2);
        if (e.moveT >= e.moveDur) { e.moving = false; e.frame = 0; e.hopping = 0; }
      } else {
        e.frame = 0;
        this._npcThink(e);
      }
    }

    // Remote players interpolate towards the position their presence reports.
    for (const r of this.remotes.values()) this._updateRemote(r);
  }

  _npcThink(e) {
    if (this.busy) return;
    if (e.movement === 'still') return;
    if (--e.think > 0) return;
    e.think = 60 + Math.floor(Math.random() * 140);
    const dirs = ['up', 'down', 'left', 'right'];
    const d = dirs[Math.floor(Math.random() * 4)];
    if (e.movement === 'lookAround') { e.dir = d; return; }
    if (e.movement === 'wander') {
      const [dx, dy] = DIRS[d];
      // Stay near home so wandering NPCs never drift out of their scene.
      if (Math.abs(e.x + dx - e.homeX) > 2 || Math.abs(e.y + dy - e.homeY) > 2) { e.dir = d; return; }
      this.startMove(e, d);
    }
  }

  _finishPlayerStep() {
    const p = this.player;
    p.moving = false;
    p.frame = 0;
    p.hopping = 0;
    p.stepPhase = (p.stepPhase + 1) % 4;
    this.state.player.x = p.x;
    this.state.player.y = p.y;
    this.state.player.dir = p.dir;
    this.state.stats.steps++;
    // Walking with you is how a Pokémon warms to you. Only the lead one, and
    // only every so often, so a long route is a nudge and not a shortcut.
    if (this.state.stats.steps % 128 === 0 && this.state.party.length) {
      onWalked(this.state.party[0]);
    }
    if (this.state.repelSteps > 0) this.state.repelSteps--;

    // The Day Care counts the same steps: the pair you left grows, an Egg may
    // turn up, and one you are carrying gets closer to hatching.
    if (this.state.daycare) {
      const news = daycareWalk(this.state.daycare, this.state.party, 1);
      if (news.hatched && this.onHatch) this.onHatch(news.hatched);
    }
    if (this.onStep) this.onStep();

    // A way out that a warp cannot describe: the Underground's ladders come up
    // wherever you went down, and a Secret Base's door comes out at whichever
    // wall its owner cut it into. Both are scripts, on a tile.
    const out = this.map.stepOut;
    if (out && ((out.tile && this.tileAt(p.x, p.y) === out.tile)
      || (out.x === p.x && out.y === p.y))) {
      this.pendingLadder = { x: p.x, y: p.y, script: out.script };
      return;
    }

    // Warp?
    const warp = this.warpAt(p.x, p.y);
    // A gated warp is refused at `canEnter`, so anything reached here is open.
    if (warp) { this.pendingWarp = warp; return; }

    // Scripted step event? Most fire once and set their flag; one marked
    // `repeat` fires every time you stand on it, which is how a doorway that
    // is also a cutscene works — the script decides what state you are in.
    const stepEvent = this.map.events.find((ev) => ev.x === p.x && ev.y === p.y
      && (ev.repeat || !this.state.flags[ev.flag])
      && (!ev.requires || this.state.flags[ev.requires]));
    if (stepEvent) { this.pendingEvent = stepEvent; return; }

    // Trainer spotted us?
    const spotter = this._trainerSeeing(p.x, p.y);
    if (spotter) { this.pendingTrainer = spotter; return; }

    // Wild encounter?
    const def = this.defAt(p.x, p.y);
    const table = this.map.encounters
      && (def.tall ? this.map.encounters.grass : (this.map.kind === 'cave' ? this.map.encounters.cave : null));
    const now = this._tableForNow(table);
    if (now && this.encounterCooldown <= 0 && this.canBattle()) this._rollEncounter(now);
  }

  /**
   * The table for the hour. A map may give a `night` or `morning` variant
   * beside its default one; anything that does not falls back to the default,
   * so adding a nocturnal roster to one route does not mean writing three for
   * every route.
   */
  _tableForNow(table) {
    if (!table) return null;
    const byPhase = table[currentPhase()];
    return byPhase || table;
  }

  _rollEncounter(table) {
    if (this.state.repelSteps > 0) {
      const lead = this.state.party.find((m) => m.hp > 0);
      if (lead && lead.level >= table.max) return;
    }
    // Rising odds the longer you walk without one, so grass never feels dead.
    this.stepsSinceEncounter++;
    const base = 0.11 + Math.min(0.14, this.stepsSinceEncounter * 0.008);
    if (Math.random() > base) return;
    this.stepsSinceEncounter = 0;
    this.encounterCooldown = 20;
    const r = Math.random;
    const species = weightedPick(table.table.map(([id, w]) => [id, w]), r);
    const level = table.min + Math.floor(r() * (table.max - table.min + 1));
    this.pendingEncounter = { species, level };
  }

  /**
   * Whether the player has anything that could take the field.
   *
   * Without this a trainer will happily start a battle against an empty
   * party, and the battle screen then waits forever for a Pokemon that is
   * never coming. Checked here rather than in the battle screen because the
   * right answer is for the battle never to start.
   */
  /** Whether the other player is actually here, on the wire, right now. */
  linkedNow() {
    const snap = this.state && this.state.link;
    if (snap) return !!(snap.connected && snap.partner);
    return !!(this.remotes && this.remotes.size);
  }

  canBattle() {
    return (this.state.party || []).some((m) => m && !m.isEgg && m.hp > 0);
  }

  _trainerSeeing(px, py) {
    if (!this.canBattle()) return null;
    for (const e of this.entities) {
      const t = e.data && e.data.trainer;
      if (!t || !e.visible) continue;
      if (this.state.flags[`beat_${t}`]) continue;
      const sight = e.data.sight || 0;
      if (sight <= 0) continue;
      const [dx, dy] = DIRS[e.dir];
      for (let i = 1; i <= sight; i++) {
        const cx = e.x + dx * i, cy = e.y + dy * i;
        if (this.defAt(cx, cy).solid) break;
        if (cx === px && cy === py) return e;
      }
    }
    return null;
  }

  // ---- interaction ----------------------------------------------------------

  /** What pressing A in front of the player would hit. */
  facingTarget() {
    const p = this.player;
    const [dx, dy] = DIRS[p.dir];
    let tx = p.x + dx, ty = p.y + dy;

    // The walking partner is not in the collision set, so it has to be
    // checked by hand — otherwise you would talk straight through it.
    const c = this.companion;
    if (c && c.visible && c.x === tx && c.y === ty) {
      return { type: 'companion', entity: c };
    }
    const f = this.follower;
    if (f && f.visible && f.mon && f.x === tx && f.y === ty) {
      return { type: 'partner', mon: f.mon, entity: f };
    }

    let e = this.entityAt(tx, ty) || this.remoteAt(tx, ty);
    // Talking across a shop or centre counter.
    if (!e && this.defAt(tx, ty).name === 'counter') {
      const bx = tx + dx, by = ty + dy;
      const behind = this.entityAt(bx, by);
      if (behind && behind.data && behind.data.overCounter) { e = behind; tx = bx; ty = by; }
    }
    if (e) {
      if (e.kind === 'remote') return { type: 'player', entity: e };
      if (e.kind === 'item') return { type: 'item', entity: e };
      return { type: 'npc', entity: e };
    }
    const sign = this.signAt(tx, ty);
    if (sign) return { type: 'sign', sign };
    const def = this.defAt(tx, ty);
    if (def.name === 'PC') return { type: 'pc' };
    if (def.name === 'bookshelf') return { type: 'flavour', text: 'Shelves of well-thumbed books about Pokémon.' };
    if (def.name === 'TV') return { type: 'flavour', text: 'A documentary about migrating Pokémon is on.' };
    if (def.name === 'bed') return { type: 'flavour', text: 'Neatly made. It looks very comfortable.' };
    if (def.soil) return { type: 'soil', x: tx, y: ty };
    // An obstacle that answers to a field move. The world offers it; whether
    // the player may actually use it is the field-move system's business.
    if (def.field) return { type: 'field', id: def.field, x: tx, y: ty };
    if (def.water && !def.field && canUse(this.state, 'surf')) {
      return { type: 'field', id: 'surf', x: tx, y: ty };
    }
    // Inside a Secret Base: the board on the back wall, and whatever has been
    // put on the floor. Both are save data rather than tiles, so the world has
    // to ask the game for them.
    if (this.mapId === 'secret_base') {
      const found = this.baseTarget && this.baseTarget(tx, ty);
      if (found) return found;
    }
    // The Underground. A seam you can work, a wall soft enough to cut a room
    // into, and the way back up.
    if (def.dig) return { type: 'dig', x: tx, y: ty, depth: def.dig };
    if (def.base) return { type: 'baseWall', x: tx, y: ty };

    // The water's edge. Whether this is a fishing spot or a nice view is up
    // to the screen, which is the thing that knows what is in the bag.
    if (def.water) return { type: 'water', x: tx, y: ty };
    return null;
  }

  /** Turns an NPC to face the player when spoken to. */
  faceEntityToPlayer(e) {
    if (!e || e.moving) return;
    const dx = this.player.x - e.x, dy = this.player.y - e.y;
    if (Math.abs(dx) > Math.abs(dy)) e.dir = dx > 0 ? 'right' : 'left';
    else e.dir = dy > 0 ? 'down' : 'up';
  }

  removeEntity(id) {
    const i = this.entities.findIndex((e) => e.id === id);
    if (i >= 0) this.entities.splice(i, 1);
  }

  // ---- remote players ---------------------------------------------------------

  /** Reconciles the remote player list against the current network peers. */
  syncRemotes(peers) {
    const seen = new Set();
    for (const { peer, presence } of peers) {
      seen.add(peer);
      let e = this.remotes.get(peer);
      if (!e) {
        e = makeEntity({
          id: `remote:${peer}`, kind: 'remote', x: presence.x, y: presence.y,
          dir: presence.dir, look: presence.look, name: presence.name, solid: false,
        });
        e.targetX = presence.x;
        e.targetY = presence.y;
        e.rx = presence.x * TILE;
        e.ry = presence.y * TILE;
        this.remotes.set(peer, e);
      }
      e.presence = presence;
      e.name = presence.name;
      e.look = presence.look;
      e.dir = presence.dir;
      e.targetX = presence.x;
      e.targetY = presence.y;
      e.onThisMap = presence.map === this.mapId;
      e.busy = presence.busy;
      e.lastSeen = performance.now();
    }
    for (const [peer] of this.remotes) if (!seen.has(peer)) this.remotes.delete(peer);
  }

  _updateRemote(e) {
    // Smooth towards the reported tile. Presence is absolute state sampled at
    // ~12 Hz, so interpolation is what makes a partner look like they are
    // walking rather than teleporting.
    const tx = e.targetX * TILE, ty = e.targetY * TILE;
    const dx = tx - e.rx, dy = ty - e.ry;
    const dist = Math.hypot(dx, dy);
    if (dist > TILE * 6) { e.rx = tx; e.ry = ty; }     // too far: snap
    else if (dist > 0.4) {
      const speed = Math.max(1.6, dist * 0.22);
      e.rx += (dx / dist) * Math.min(dist, speed);
      e.ry += (dy / dist) * Math.min(dist, speed);
      e.frame = 1 + (Math.floor(performance.now() / 130) % 2);
    } else {
      e.rx = tx; e.ry = ty;
      e.frame = 0;
    }
    e.x = e.targetX;
    e.y = e.targetY;
  }

  remotesHere() {
    return [...this.remotes.values()].filter((e) => e.onThisMap);
  }
}

export { getTrainer };
