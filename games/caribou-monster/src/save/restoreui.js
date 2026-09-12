// The restore panel: real DOM, because a canvas cannot open a file picker.
//
// This exists because LOAD BACKUP did nothing at all, and the reason is worth
// writing down. Every tap in this game is recorded by a touch listener and
// then *consumed later*, on the next logic tick, because the whole game runs
// on a fixed timestep. By the time the title screen decided the player had
// pressed LOAD BACKUP, the browser no longer considered a gesture to be in
// progress — and `input.click()` on a file input outside a user gesture is
// silently ignored. No picker, no error, nothing.
//
// So the button the player presses here is a real HTML button, and the file
// input is a real file input, and the browser sees a genuine tap on it. The
// paste box is the belt to that braces: on a phone, holding down on a text
// field and hitting Paste needs no capability, no picker and no permission.
import { input } from '../core/input.js';

const CSS = `
.cbm-restore {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 11, 24, 0.88);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  padding: 16px; box-sizing: border-box;
}
.cbm-restore-card {
  width: 100%; max-width: 420px; max-height: 100%; overflow-y: auto;
  background: #f8f4e4; color: #2b3450;
  border: 3px solid #2b3450; border-radius: 6px;
  padding: 14px; box-sizing: border-box;
}
.cbm-restore h2 { margin: 0 0 4px; font-size: 15px; letter-spacing: 1px; }
.cbm-restore p { margin: 0 0 10px; font-size: 12px; line-height: 1.45; color: #5a6a94; }
.cbm-restore label.cbm-file, .cbm-restore button {
  display: block; width: 100%; box-sizing: border-box;
  margin: 0 0 8px; padding: 11px 12px;
  font: inherit; font-size: 13px; text-align: center;
  border: 2px solid #2b3450; border-radius: 4px;
  background: #3f6fd4; color: #ffffff; cursor: pointer;
}
.cbm-restore button.cbm-ghost { background: #e6dfc6; color: #2b3450; }
.cbm-restore input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; }
.cbm-restore textarea {
  width: 100%; box-sizing: border-box; height: 74px; margin-bottom: 8px;
  font: inherit; font-size: 11px; padding: 8px;
  border: 2px solid #b9b096; border-radius: 4px;
  background: #ffffff; color: #2b3450; resize: vertical;
}
.cbm-restore .cbm-note { min-height: 15px; font-size: 11px; color: #d8493f; margin: 2px 0 8px; }
.cbm-restore hr { border: 0; border-top: 1px solid #d8d0b8; margin: 12px 0; }
`;

/** Checks a parsed payload really is one of our saves before anything is overwritten. */
function validate(text) {
  let raw;
  try { raw = JSON.parse(String(text).trim()); } catch { return { ok: false, text: 'That is not readable as a save.' }; }
  if (!raw || !raw.state || !raw.meta) return { ok: false, text: 'That is not a save from this game.' };
  const who = raw.meta.name || 'Trainer';
  const badges = raw.meta.badges || 0;
  return { ok: true, raw, text: `Found ${who}, ${badges} badge${badges === 1 ? '' : 's'}.` };
}

/**
 * Opens the panel and resolves with `{ok, raw, text}`.
 *
 * Game input is switched off while it is open, so a tap meant for the panel
 * cannot also walk the player into a wall behind it.
 */
export function openRestorePanel() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve({ ok: false, text: 'No restore here.' }); return; }

    if (!document.getElementById('cbm-restore-css')) {
      const style = document.createElement('style');
      style.id = 'cbm-restore-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.className = 'cbm-restore';
    root.innerHTML = `
      <div class="cbm-restore-card">
        <h2>LOAD BACKUP</h2>
        <p>Pick the <b>pokemon-sammy-and-matt-save.json</b> you saved from this game.</p>
        <label class="cbm-file">CHOOSE FILE<input type="file" accept="application/json,.json,text/plain"></label>
        <div class="cbm-note"></div>
        <hr>
        <p>Or paste the backup text, if picking a file will not work on your phone.</p>
        <textarea placeholder="paste here"></textarea>
        <button class="cbm-paste cbm-ghost">RESTORE FROM PASTED TEXT</button>
        <button class="cbm-cancel cbm-ghost">CANCEL</button>
      </div>`;

    const file = root.querySelector('input[type=file]');
    const note = root.querySelector('.cbm-note');
    const box = root.querySelector('textarea');
    const wasEnabled = input.enabled;
    input.enabled = false;
    input.releaseAll();

    const close = (result) => {
      try { root.remove(); } catch { /* already gone */ }
      input.enabled = wasEnabled;
      input.clearTaps();
      resolve(result);
    };

    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;                       // cancelling the picker is not an answer
      note.textContent = 'Reading...';
      const reader = new FileReader();
      reader.onerror = () => { note.textContent = 'Could not read that file.'; };
      reader.onload = () => {
        const got = validate(reader.result);
        if (!got.ok) { note.textContent = got.text; return; }
        close(got);
      };
      reader.readAsText(f);
    });

    root.querySelector('.cbm-paste').addEventListener('click', () => {
      if (!box.value.trim()) { note.textContent = 'Nothing pasted yet.'; return; }
      const got = validate(box.value);
      if (!got.ok) { note.textContent = got.text; return; }
      close(got);
    });

    root.querySelector('.cbm-cancel').addEventListener('click', () => close({ ok: false, text: 'Restore cancelled.' }));

    document.body.appendChild(root);
  });
}
