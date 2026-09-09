# Caribou Monster

A mobile-first, two-player Pokémon RPG in the shape of a DS-era handheld game.
Built for phones, in plain JavaScript, with no engine and no asset pipeline —
every sprite, tile, note and sound effect is generated at runtime from data.

**Region:** Sinnoh · **Rivals:** Team Galactic · **Legendary:** Dialga.

Real Pokémon names, types, base stats, abilities and learnsets. A private fan
project for two players; not for distribution.

---

## Playing it

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Or open `dist/caribou-monster.html` — one self-contained file, no server.

**Controls.** On a phone: the on-screen D-pad and A/B buttons, and you can tap
menu entries directly. On a desktop: arrow keys / WASD, `Z` or `Enter` for A,
`X` or `Esc` for B, `Q` or `Tab` for the menu. Hold B to run.

Landscape is the intended orientation; portrait works and re-lays out the
controls.

---

## What is in the vertical slice

| | |
|---|---|
| **World** | 14 maps: Brackenvale Town, Route 1, Whisperwood Forest, Aldermere City, Route 2, Stonefall Cave and eight interiors |
| **Pokémon** | 54 species with real base stats, types, abilities, natures, genders, IVs/EVs, shinies, learnsets and evolution lines |
| **Moves** | 119, all data-driven, with the 17-type chart, STAB, criticals, accuracy, five status conditions, confusion, flinch and stat stages |
| **Progression** | Wild encounters, catching, EXP, levelling, move learning, evolution, the Aldermere Gym and its badge |
| **Systems** | Party, bag with five pockets, PC boxes, Poké Mart, Monster Centre, Pokédex, trainer card, save/load, EASY and NORMAL difficulty |
| **Co-op** | Room codes, a shared overworld, link trades and link battles |
| **Debug** | A developer menu behind OPTIONS: teleport, give monsters/items/money, set flags, force battles, inspect the network |

The story runs from waking up at home through Professor Aspen's lab, the rival,
Whisperwood, the first badge, and into Stonefall Cave where Team Meridian is
listening to something under the hill.

---

## Multiplayer is real, and here is exactly how real

The whole point of the architecture is that the game never fakes a second
player. `NetworkManager` is the only door between the game and the network,
and it picks the best transport available at boot:

| Transport | Reaches | When |
|---|---|---|
| `ArtifactRoomAdapter` | **Other devices** — two phones, genuinely | The page is published as a Claude Artifact with the `room` capability |
| `BroadcastChannelAdapter` | **Other tabs on the same device** | Anywhere else a browser is running |
| `OfflineAdapter` | Nobody | No transport available; single-player is unaffected |

The LINK screen always tells you which one you are on, in those words. It does
not say "online" when it means "two tabs".

**How two people play.** One opens LINK → CREATE ROOM and reads out the
six-character code. The other opens LINK → JOIN ROOM and types it. From then on
both characters walk around the same maps with name tags, and walking into your
partner offers BATTLE or TRADE.

**Trading is safe by construction.** A monster only ever leaves a party once
*both* sides are known to have confirmed. Any cancel, timeout or disconnect
before that point ends the session with nothing moved on either device. Changing
your offer clears both confirmations.

**Link battles never touch your team.** Both clients clone their parties, seed
one deterministic battle from `hostSeed XOR guestSeed` — so neither player
controls the outcome — and then exchange only *actions*, one per turn. Each side
runs the identical engine and compares a checksum afterwards. A disconnect
mid-battle costs you the battle and nothing else.

`tools/coop.mjs` drives two independent browser pages through all of this and
asserts it: room join, position sync, a one-sided confirm moving nothing, the
completed swap, matching battle seeds, opposite sides, a turn that waits for
both players, byte-identical simulations, and a safe disconnect.

### What would be needed to go further

The current cross-device transport rides on the artifact runtime's `room`
capability, which reaches everyone who has the page open *right now* and is
scoped to people the artifact is shared with. A dedicated backend would add:
persistent rooms that survive both players closing the tab, cloud saves
(`save/SaveManager.js` already takes a backend — `CloudBackend` is stubbed
against a three-method interface), and an authoritative referee for
tournament-grade anti-cheat. None of that changes the game code: it is a fourth
adapter behind the same interface.

---

## Architecture

```
src/
  core/     rng · events · input · loop · audio · storage
  render/   canvas · palette · font · tiles · sprites · monsterart · worldrender
  data/     types · moves · species · items · trainers · music · maps/
  game/     monster · party/state · inventory · pokedex · storyflags · evolution
            battle/{engine,ai} · overworld/{world,scripts}
  net/      protocol · adapters · NetworkManager · RoomManager
  save/     SaveManager
  ui/       screen · kit · controls · dialogue · overworld · battle · menus
            pc · shop · trade · multiplayer · title · debug
```

Three rules hold the thing together:

1. **The battle engine is pure and deterministic.** `resolveTurn()` mutates
   state and returns a list of events; nothing in it knows a canvas exists. All
   randomness comes from a seeded RNG on the battle object. That is what lets
   one engine drive a wild encounter, a gym leader and a networked link battle
   with no special cases — and what makes lock-step PvP possible without a
   referee.
2. **Content is data, not code.** Species, moves, items, trainers, music and
   maps are tables. Maps are ASCII grids validated at load, so a mistyped row is
   a loud error at boot rather than a hole in the world.
3. **Art is generated.** A 5×7 bitmap font, procedural tiles, template-based
   character sprites and an archetype+feature monster generator. Adding a
   species costs about six lines of data — which is what makes the Pokédex
   scalable to hundreds without an art budget.

Rendering is canvas-only with a fixed 60 Hz logic step; there is no DOM in the
game world, and no framework anywhere.

---

## Development

```bash
python3 build.py                       # bundle src/ -> dist/caribou-monster.html
npm install                            # dev-only: playwright, for the tests
node tools/battletest.mjs              # 400 AI battles + determinism check
node tools/play.mjs /tmp/shots         # drive every screen, screenshot each
node tools/coop.mjs index.html /tmp/co # full two-player session
node tools/touch.mjs index.html /tmp/t # touch-only run at four device sizes
node tools/audit.mjs                   # static world audit — softlocks, warps, data
node tools/walkthrough.mjs index.html /tmp/w  # scripted opening playthrough
node tools/artcheck.html via shot.mjs  # sprite/tile contact sheet
```

`build.py` has no dependencies. It walks the import graph, refuses circular
imports, and emits one file.

`tools/audit.mjs` walks every map with the game's own movement rules and proves
the world is playable: every warp lands somewhere you can stand, every arrival
leaves at least one legal move, every map can be left again, and every NPC,
item and sign can actually be reached. It also cross-checks every species,
move, item and trainer reference. A softlock costs a player their session and
is entirely preventable at build time — run it before shipping.

`tools/touch.mjs` uses no keyboard and no debug API — every step is a real tap
at a real screen coordinate, on four device shapes including high-DPR phones.
Keep it that way: a suite driven by the keyboard cannot see a broken touch
pipeline, which is exactly how pointer events once shipped mapped into the
canvas backing store instead of logical pixels.

---

## Roadmap

The slice is Phases 1–4 of the plan (playable single-player, progression,
multiplayer foundation, multiplayer gameplay). Still ahead:

- Gyms 2–8, the remaining region, the Lumaros storyline, the Monster League
- Co-op double battles — the battle engine's side model already anticipates it
- Surf/fishing water routes, the bicycle, more evolution methods (the resolver
  already handles stones, friendship, trade, held items, time and location)
- Cloud saves and persistent rooms behind the existing interfaces

Built as a private fan project for two players. Not for distribution.
