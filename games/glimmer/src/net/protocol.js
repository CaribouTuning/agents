// The wire protocol.
//
// Everything that crosses the network is defined here and nowhere else, so
// swapping the transport (artifact room today, a websocket server tomorrow)
// never touches game code.
//
// Two channels, deliberately different in character:
//
//  PRESENCE — high frequency, last-value-wins, no delivery guarantee.
//    Player position and appearance. Coalesced by the transport at ~30 Hz.
//    Absolute state only, never deltas: a dropped presence update must be
//    self-healing.
//
//  EVENTS — low frequency, ordered per sender, still no delivery guarantee.
//    Battle actions, trade steps, story milestones. Every event carries the
//    room code and a target so a peer can ignore traffic meant for others.

export const PROTOCOL_VERSION = 1;

export const TOPICS = {
  BATTLE: 'battle',
  TRADE: 'trade',
  STORY: 'story',
  CHAT: 'chat',
  SYS: 'sys',
  // The Underground: a Secret Base is the only thing in this game one player
  // publishes for the other to walk into, so it gets its own topic rather
  // than riding on the story channel.
  BASE: 'base',
};

// Every topic a page may emit on must be opened to the `interact` level at
// publish time, otherwise only editors can send. This list is the source of
// truth for the Artifact `capabilities` declaration.
export const OPEN_TOPICS = Object.values(TOPICS);

// Strips control and invisible characters from text that came off the wire.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060-\\u2064\\ufeff]', 'g');

// ---- presence -----------------------------------------------------------

export function makePresence(state, extra = {}) {
  const p = state.player;
  return {
    v: PROTOCOL_VERSION,
    code: extra.code || null,
    name: String(p.name || 'Trainer').slice(0, 12),
    look: p.look || 'boy',
    map: p.map,
    x: Math.round(p.x),
    y: Math.round(p.y),
    dir: p.dir,
    moving: !!extra.moving,
    frame: extra.frame | 0,
    badges: state.badges.length,
    party: state.party.length,
    // What this player is doing — lets a partner's client show the right
    // prompt instead of walking into a busy trainer.
    busy: extra.busy || 'free',   // free | battle | trade | menu
    story: extra.story || 0,
    t: Date.now(),
  };
}

// Presence arrives from another device: treat every field as untrusted.
export function sanitisePresence(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v, lo, hi, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
  };
  const str = (v, max, d = '') =>
    (typeof v === 'string' ? v.replace(CONTROL_CHARS, '').slice(0, max) : d);
  const dir = ['up', 'down', 'left', 'right'].includes(raw.dir) ? raw.dir : 'down';
  return {
    v: num(raw.v, 0, 99, 0),
    code: str(raw.code, 8, '') || null,
    name: str(raw.name, 12, 'Trainer') || 'Trainer',
    look: str(raw.look, 24, 'boy'),
    map: str(raw.map, 40, ''),
    x: num(raw.x, -999, 999),
    y: num(raw.y, -999, 999),
    dir,
    moving: !!raw.moving,
    frame: num(raw.frame, 0, 3),
    badges: num(raw.badges, 0, 8),
    party: num(raw.party, 0, 6),
    busy: ['free', 'battle', 'trade', 'menu'].includes(raw.busy) ? raw.busy : 'free',
    story: num(raw.story, 0, 20),
    t: num(raw.t, 0, Number.MAX_SAFE_INTEGER),
  };
}

// ---- events --------------------------------------------------------------

export const MSG = {
  // link
  HELLO: 'hello',
  BYE: 'bye',
  // battle
  BATTLE_REQUEST: 'battle.request',
  BATTLE_ACCEPT: 'battle.accept',
  BATTLE_DECLINE: 'battle.decline',
  BATTLE_TEAM: 'battle.team',
  BATTLE_ACTION: 'battle.action',
  BATTLE_SWITCH: 'battle.switch',
  BATTLE_FORFEIT: 'battle.forfeit',
  BATTLE_SYNC: 'battle.sync',
  // trade
  TRADE_REQUEST: 'trade.request',
  TRADE_ACCEPT: 'trade.accept',
  TRADE_DECLINE: 'trade.decline',
  TRADE_OFFER: 'trade.offer',
  TRADE_UNOFFER: 'trade.unoffer',
  TRADE_CONFIRM: 'trade.confirm',
  TRADE_UNCONFIRM: 'trade.unconfirm',
  TRADE_COMMIT: 'trade.commit',
  TRADE_CANCEL: 'trade.cancel',
  // story
  STORY_MILESTONE: 'story.milestone',
  // the Underground
  BASE_SHARE: 'base.share',
  BASE_FLAG: 'base.flag',
};

const MSG_KINDS = new Set(Object.values(MSG));

export function makeMessage(kind, code, to, data = {}) {
  return { v: PROTOCOL_VERSION, k: kind, code, to: to || null, d: data, t: Date.now() };
}

// Inbound messages are untrusted input from another player's device.
// Reject anything malformed rather than letting it reach game systems.
export function validateMessage(raw, myCode) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v !== PROTOCOL_VERSION) return null;
  if (typeof raw.k !== 'string' || !MSG_KINDS.has(raw.k)) return null;
  if (myCode && raw.code !== myCode) return null;      // not for our room
  if (raw.to != null && typeof raw.to !== 'string') return null;
  const d = raw.d;
  if (d != null && (typeof d !== 'object' || Array.isArray(d))) return null;
  return { kind: raw.k, code: raw.code, to: raw.to || null, data: d || {}, t: Number(raw.t) || 0 };
}

export function cleanText(s, max = 64) {
  return String(s == null ? '' : s).replace(CONTROL_CHARS, '').slice(0, max);
}

// ---- room codes -----------------------------------------------------------
// Six characters, no vowels (so no accidental words) and no 0/O/1/I.
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';

export function generateRoomCode() {
  let s = '';
  const buf = new Uint32Array(6);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < 6; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
  for (let i = 0; i < 6; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function normaliseRoomCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function isValidRoomCode(code) {
  return /^[A-Z0-9]{6}$/.test(code || '');
}

// ---- battle sync ------------------------------------------------------------
// A networked battle is lock-step: both clients run the same deterministic
// engine on the same seed, exchange one action per turn, and compare a
// checksum afterwards. Only the actions cross the wire, never the outcome —
// so neither side can dictate a result to the other.

export function encodeTeam(party) {
  return party.slice(0, 6).map((m) => ({
    species: m.species, level: m.level, nickname: m.nickname || null,
    nature: m.nature, gender: m.gender, shiny: !!m.shiny, ability: m.ability,
    ivs: m.ivs, evs: m.evs, hp: m.hp, status: m.status, statusCounter: m.statusCounter || 0,
    heldItem: m.heldItem || null, uid: m.uid,
    moves: m.moves.map((mv) => ({ id: mv.id, pp: mv.pp, ppMax: mv.ppMax })),
  }));
}

export function encodeAction(action) {
  if (!action) return null;
  const a = { type: action.type };
  if (action.index != null) a.index = action.index | 0;
  if (action.item) a.item = String(action.item).slice(0, 32);
  if (action.target != null) a.target = action.target | 0;
  return a;
}

export function decodeAction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const types = ['move', 'switch', 'item', 'run'];
  if (!types.includes(raw.type)) return null;
  const a = { type: raw.type };
  if (raw.index != null) a.index = Math.max(0, Math.min(5, raw.index | 0));
  if (typeof raw.item === 'string') a.item = raw.item.slice(0, 32);
  if (raw.target != null) a.target = Math.max(0, Math.min(5, raw.target | 0));
  return a;
}
