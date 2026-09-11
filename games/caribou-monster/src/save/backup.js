// Backing a save up to a file, and reading one back in.
//
// This exists because durable storage has failed for this player three times
// running, and a playthrough that cannot be rescued is the one bug it is not
// acceptable to still be chasing. Whatever the capability layer is doing, a
// file on their phone is a save they own.
//
// Export goes through the `downloads` capability (frame code cannot start a
// download directly in the artifact sandbox), with a plain anchor and then
// the clipboard behind it. Reading a backup back in lives in `restoreui.js`,
// which needs a real DOM control the player taps themselves — see the note
// at the top of that file for why a synthetic click could never work.
import { SAVE_SLOT, SAVE_VERSION } from './SaveManager.js';
import { serializeState } from '../game/state.js';

const FILENAME = 'caribou-monster-save.json';

/** The same payload shape the storage layer writes, as text. */
export function exportText(state) {
  return JSON.stringify({
    v: SAVE_VERSION,
    savedAt: Date.now(),
    state: serializeState(state),
    meta: {
      name: state.player.name,
      badges: state.badges.length,
      dex: Object.keys(state.dex.caught).length,
      playTimeMs: state.playTimeMs,
      map: state.player.map,
      party: state.party.map((m) => ({ species: m.species, level: m.level, shiny: !!m.shiny })),
    },
  }, null, 0);
}

/**
 * Offers the save to the viewer as a file.
 *
 * Three routes, because there is no single one that works everywhere. Framed
 * in the viewer, `claude.use('downloads')` is the only way out — frame code
 * cannot start a download itself. Served top-level, which is how this opens
 * on a phone, every `claude.use()` resolves null by contract, but an ordinary
 * anchor download works fine. And if both are shut, the text itself goes to
 * the clipboard, because a save the player can paste into their notes is
 * still a save.
 *
 * Resolves a short human sentence either way — this is shown on a screen the
 * player is looking at, so "it worked" and "you said no" both have to be
 * sayable without an error code.
 */
export async function exportToFile(state) {
  const text = exportText(state);
  const viaCap = await saveViaCapability(text);
  if (viaCap) return viaCap;
  if (saveViaAnchor(text)) return { ok: true, text: 'Backup downloaded. Keep it.' };
  if (await saveViaClipboard(text)) return { ok: true, text: 'Backup copied. Paste it somewhere safe.' };
  return { ok: false, text: 'Nothing here can save a file.' };
}

/** The framed route. Returns null when the capability is not there at all. */
async function saveViaCapability(text) {
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (!c || typeof c.use !== 'function') return null;
  let downloads = null;
  try { downloads = await c.use('downloads'); } catch { downloads = null; }
  if (!downloads) return null;
  try {
    await downloads.save({ filename: FILENAME, data: text });
    return { ok: true, text: 'Backup saved. Keep it somewhere.' };
  } catch (err) {
    const code = (err && err.code) || 'unavailable';
    // A refusal is an answer; anything else means try the other routes.
    if (code === 'declined') return { ok: false, text: 'Backup cancelled.' };
    if (code === 'rate_limited') return { ok: false, text: 'Busy — try that again in a moment.' };
    return null;
  }
}

/** The top-level route: a blob URL and a click. Needs no capability. */
function saveViaAnchor(text) {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = FILENAME;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch { /* gone */ } }, 4000);
    return true;
  } catch { return false; }
}

/** The last resort. A save in the clipboard still loads back through paste. */
async function saveViaClipboard(text) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

export { SAVE_SLOT };
