// The overworld simulation.
//
// Grid-based like the games it is modelled on: an entity always occupies a
// whole tile and animates between tiles. Everything downstream — collision,
// encounters, trainer sight, the camera — is simple and predictable because
// of that, and it is what makes the movement feel right rather than floaty.
import { getMap } from '../../data/maps/index.js';
import { onWalked } from '../friendship.js';
import { tileDef } from '../../render/tiles.js';
import { getTrainer } from '../../data/trainers.js';
import { weightedPick } from '../../core/rng.js';
import { TILE } from '../../render/canvas.js';

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
    this.pendingWarp = null;
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

    for (const npc of this.map.npcs) {
      if (npc.trainer && this.state.flags[`beat_${npc.trainer}`] && npc.removeAfter) continue;
      this.entities.push(makeEntity({ ...npc, kind: 'npc' }));
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
  }

  // ---- queries -------------------------------------------------------------

  tileAt(x, y) {
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
    if (!this.canEnter(entity, nx, ny, dirName)) return false;

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
    return true;
  }

  face(entity, dirName) { if (!entity.moving) entity.dir = dirName; }

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
    if (this.onStep) this.onStep();

    // Warp?
    const warp = this.warpAt(p.x, p.y);
    if (warp) { this.pendingWarp = warp; return; }

    // Scripted step event? Most fire once and set their flag; one marked
    // `repeat` fires every time you stand on it, which is how a doorway that
    // is also a cutscene works — the script decides what state you are in.
    const stepEvent = this.map.events.find((ev) => ev.x === p.x && ev.y === p.y
      && (ev.repeat || !this.state.flags[ev.flag]));
    if (stepEvent) { this.pendingEvent = stepEvent; return; }

    // Trainer spotted us?
    const spotter = this._trainerSeeing(p.x, p.y);
    if (spotter) { this.pendingTrainer = spotter; return; }

    // Wild encounter?
    const def = this.defAt(p.x, p.y);
    const table = this.map.encounters
      && (def.tall ? this.map.encounters.grass : (this.map.kind === 'cave' ? this.map.encounters.cave : null));
    if (table && this.encounterCooldown <= 0) this._rollEncounter(table);
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

  _trainerSeeing(px, py) {
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
    if (def.water) return { type: 'flavour', text: 'The water is clear and deep.' };
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
