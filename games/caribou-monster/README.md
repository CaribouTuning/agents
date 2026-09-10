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
| **World** | 16 maps: Twinleaf Town, Route 201, Route 202, Oreburgh City, Route 207, Oreburgh Gate, the Everlight Chamber and nine interiors |
| **Pokémon** | 54 species with real base stats, types, natures, genders, IVs/EVs, shinies, learnsets and evolution lines — plus nicknaming, friendship that moves, held items you can give and take, and **18 working abilities** |
| **Moves** | 119, all data-driven, with the 17-type chart, STAB, criticals, accuracy, five status conditions, confusion, flinch and stat stages |
| **Progression** | Wild encounters, catching, EXP, levelling, move learning, evolution, the Oreburgh Gym and its badge |
| **Systems** | Party, bag with five pockets, PC boxes, Poké Mart, Pokémon Center, Pokédex, trainer card, save/load, EASY and NORMAL difficulty |
| **World Circuit** | A second career track: 6 sanctioned tournaments, 12 professional trainers, an Elo world ranking, Circuit Points, promotions, a press feed and post-event press conferences |
| **Living world** | Conditional NPC dialogue: everyone reacts to your starter, badges, Pokédex, story flags, circuit rank, titles and how you talk to the press — and names the trainer who is *actually* world number one |
| **Co-op** | Room codes, a shared overworld, link trades and link battles |
| **Debug** | A developer menu behind OPTIONS: teleport, give monsters/items/money, set flags, force battles, inspect the network |

---

## The story

The shape is the one you remember: a starter, a rival, a road, a badge, a
team in matching coats, and something enormous asleep under a hill. What is
underneath it is written to be re-read.

**Cass Wren** grew up four doors down. She started a year before you, got up at
seven to take the starter that beats yours, and says "one year ahead" like it is
a fact about the universe. She is also rated 1180 on the World Circuit — the
same Cass Wren you will meet in the Battle Hall, and in the Sinnoh Open, and
eventually in a final. One person, one relationship, from a dirt road in
Twinleaf to the World Finals. The third time you meet her on the road she is not
keeping score: she is standing in the way of Oreburgh Gate telling you not to go
in, and when you go in anyway she gives you her mother's Hyper Potions.

**Professor Rowan** is not a vending machine that dispenses a starter. He hands
you a Pokédex and mentions, as an aside nobody remembers, that it also logs
ambient light — "an old habit of mine, the data has to go somewhere."

**The turn** happens when you pick up the Aurora Charm. It is warm. The Pokédex
chirps twice and Rowan is on the line, because his readings just went off the
top of the scale, and he needs to know one thing: *is it warm*. It is. Then it
has been in that rock for minutes, not centuries. It is not an artefact you
found — it is a key, and Galactic built it, because the door does not open for
anyone who wants in. They left it where a trainer would find it and they waited.
Mars did not lose to you. She stepped aside.

And Rowan knew. He stood in front of that seam thirty-one years ago with a full
team and every instrument he owned, and it would not open, and he has spent
three decades working out that what he got wrong was *wanting in*. So he sent
somebody who was only walking a road because an old man told them it was the
whole point.

Almost every scene before that reads differently afterwards. Mars leaves her
expensive instruments behind without looking at them. Her three flat lines —
"One trainer. Noted. We will not make that mistake twice" — are a threat on the
way in and a box being ticked on the way out. A Galactic memo forbids field
staff from carrying the artefact into the chamber approach: *not once, not to
test it*, and if you work out why, keep it to yourself. The story is solvable,
not merely survivable — every piece is findable before the reveal.

Behind the door is Dialga, with its back to you, and it has been standing that
way for a very long time. It was not guarding the light. It was holding the door
shut from the inside, alone, and nobody had ever come to help. It turns around
and it is not surprised. It is relieved.

Mars gets there four hours late. Fourteen months of operation, two commanders,
nine sites; they built the key, picked the hill, and picked the trainer. They
picked you. And you were four hours faster than the people who wrote the plan.

Nobody dies and nothing is bittersweet. It is the game you remember, written for
someone who has since read some books.

### When there are two of you

The story is written for one player, but the world notices when it is not one
player. `worldSnapshot` takes the network's own snapshot, so `when: { linked:
true }` is a condition like any other and `{partner}` is a slot like any other —
and both are filled with whoever is actually connected, right now, by name.

Your mum asks whether they are out there with you and says she worries
considerably less when there are two. The postman complains about the double
round and then admits he does not mind. Tam is beside himself. The Wire's
reporter points out that two names from the same town on the same feed is a
story. Cass, standing in front of Oreburgh Gate, objects to the arithmetic:
"Two of you. Against one of me. In what world is that the fair version." And
when Rowan calls about the charm, the first thing he asks is whether you are
alone, because he was.

`tools/coop.mjs` proves it with two real browser clients: the same NPC, asked
alone and asked linked, has to say something different — and has to name the
partner in one case and not the other.

### The journal

A Pokémon game tells you what to do next by having somebody say it once, out
loud, forty minutes ago. That was fine on a school bus every day for a month;
it is not fine when you pick this up on a Tuesday having last touched it three
weeks ago.

So every beat writes a journal entry — what you *worked out*, not what the
engine did — and the top of the screen always says what you are doing now.
`tools/storytest.mjs` runs the whole plot headlessly against a fake cutscene
context, asserts each beat fires once and in order, and fails if a journal entry
exists that no script ever writes (a page you could never turn to) or a script
writes one that does not exist.

---

## The World Circuit

The competitive side story, entered at the **Oreburgh Battle Hall** — the grey
building on the east side of Oreburgh City. Register at the desk and you join a
world ranking that was already running before you arrived.

| | |
|---|---|
| **Ladder** | Eight ranks from Rookie to Circuit Legend, gated on Circuit Points |
| **Events** | Rookie Cup → Sinnoh Open → Regional Invitational → National Championship → Continental Cup → World Circuit Finals, at levels 14 to 70 |
| **Field** | 12 pros with fixed species pools, personalities and their own Elo — including Cass Wren, who came up one season ahead of you, and Nadia Sable, world number one for eleven straight seasons |
| **Ranking** | Elo rating that moves both ways, plus Circuit Points that only go up. One measures how good you are now; the other measures what you have done |
| **Press** | Five outlets and six analysts filing on every result, promotion, streak, upset and rivalry, plus a press conference after each event where your answer trades Respect against Hype |

Two properties are load-bearing:

**The season runs without you.** The twelve pros play each other every week
whether or not you entered anything. Ratings drift, upsets happen, and the
standings you come back to are not the ones you left. A rank you climb to is a
rank you took off somebody.

**Nothing in the feed is flavour.** Every headline is generated from a result
the engine actually produced — a real opponent, a real round, a real number.
`tools/circuittest.mjs` asserts that: no story may contain an unfilled slot, and
every title, opponent and event named in the feed has to exist.

Link battles against the other player count towards the same ranking — but only
when both clients played the match to a conclusion. A forfeit, a timeout or a
disconnect ends the session and moves nothing, because a ranking built on
unverified results is not a ranking.

---

## Abilities

Every Pokémon has always carried an ability name on its summary screen, and for
a long time nothing read it — so Overgrow and Simple were the same thing:
decoration. `game/battle/abilities.js` is the table that makes them mean
something. Eighteen are implemented: the pinch boosters, Intimidate, Levitate,
Flash Fire, Guts, Rock Head, Natural Cure, Shed Skin, Inner Focus, Steadfast,
Keen Eye, Hyper Cutter, Pressure, Shield Dust, Synchronize and Run Away.

Eight more are listed as **knowingly inert**, with the reason — Chlorophyll and
Swift Swim need weather this game does not have, Cute Charm needs infatuation,
Sticky Hold needs something that steals held items. The summary screen says so
in as many words rather than describing an effect that is not there, and
`tools/audit.mjs` rejects any ability that is neither implemented nor on that
list. A silent no-op is how a system rots: nobody can tell the unimplemented
from the broken.

Two rules keep them safe in a link battle: an ability may only use
`battle.rng`, and a roll that an ability cancels still happens — otherwise the
first proc would shift the shared random stream and desync the two phones.
`tools/abilitytest.mjs` builds the exact situation each one is for, runs a real
turn, and asserts the outcome differs from the same turn without it. An ability
that cannot be told apart from its absence is a label, not a mechanic.

---

## The world talks back

Every NPC line is data with a condition attached. `game/overworld/gossip.js`
builds a snapshot of the save — flags, badges, Pokédex, party, circuit standing,
press reputation — and picks the first branch whose condition holds:

```js
dialogue: [
  { when: { champion: true }, lines: ['{player}. {player}! You are number one in the WORLD.', ...] },
  { when: { topTen: true },   lines: ['You are number {place} in the world!', ...] },
  { when: { joined: true },   pool: [[...], [...], [...]] },   // rotates per talk
  { lines: ['Professor Rowan is handing out Pokémon today.'] },  // always true, last
]
```

Slots are filled from live state, which is what stops the world drifting out of
step with itself. `{champion}` is whoever genuinely tops the world ranking right
now — so Tam, the kid in Twinleaf, spends the early game telling you how
untouchable Nadia Sable is, and ends it telling *you* that he had somebody
else's posters up for years. `{starter}`, `{lead}`, `{place}`, `{rating}`,
`{lastTitle}`, `{rival}` and `{headline}` all read the same way. Signs are
templated too: the notice board in the Battle Hall carries the current world
number one and your own line under it.

Reputation is a real input. The press conference after each event trades Hype
against Respect, and NPCs read both — the Wire's reporter has a folder on you if
you give good copy, the groundskeeper mentions that the locker room speaks well
of you if you don't.

Two tools keep it honest. `tools/audit.mjs` refuses any condition the resolver
does not understand, any template slot it cannot fill, and any NPC whose branches
could all miss (an NPC that falls silent is a bug, not a mood).
`tools/dialoguetest.mjs` drives a synthetic save through twelve career stages —
no starter, first badge, the cave, joined, mid-event, titles, all-hype,
all-respect, world number one — asks every NPC in every map at each one, and
fails on a branch that never fires anywhere. Dead dialogue is dead content.

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
  data/     types · moves · species · items · trainers · music · circuit · news · maps/
  game/     monster · party/state · inventory · pokedex · storyflags · evolution
            battle/{engine,ai} · overworld/{world,scripts,gossip} · circuit/{circuit,news,career}
  net/      protocol · adapters · NetworkManager · RoomManager
  save/     SaveManager
  ui/       screen · kit · controls · dialogue · overworld · battle · menus
            pc · shop · trade · multiplayer · circuit · title · debug
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
node tools/circuittest.mjs             # World Circuit careers, brackets, press, saves
node tools/dialoguetest.mjs            # every NPC branch, across fourteen career stages
node tools/abilitytest.mjs             # every ability, proved against its own absence
node tools/storytest.mjs               # every story beat, headless, in order
node tools/walkthrough.mjs index.html /tmp/w  # scripted opening playthrough
node tools/artcheck.html via shot.mjs  # sprite/tile contact sheet
```

`build.py` has no dependencies. It walks the import graph, refuses circular
imports, and emits one file.

`tools/audit.mjs` walks every map with the game's own movement rules and proves
the world is playable: every warp lands somewhere you can stand, every arrival
leaves at least one legal move, every map can be left again, and every NPC,
item and sign can actually be reached. It also cross-checks every species,
move, item and trainer reference. It also checks the circuit: every pro's
species pool, every bracket size, every rank gate's reachability, every news
template's slot, and every NPC dialogue condition, slot and fallback. A softlock costs a player their session and is entirely
preventable at build time — run it before shipping.

`tools/touch.mjs` uses no keyboard and no debug API — every step is a real tap
at a real screen coordinate, on four device shapes including high-DPR phones.
Keep it that way: a suite driven by the keyboard cannot see a broken touch
pipeline, which is exactly how pointer events once shipped mapped into the
canvas backing store instead of logical pixels.

---

## Roadmap

The slice is Phases 1–4 of the plan (playable single-player, progression,
multiplayer foundation, multiplayer gameplay). Still ahead:

- Gyms 2–8, the remaining region, the Team Galactic storyline, the Pokémon League
- Co-op double battles — the battle engine's side model already anticipates it
- Surf/fishing water routes, the bicycle, more evolution methods (the resolver
  already handles stones, friendship, trade, held items, time and location)
- Cloud saves and persistent rooms behind the existing interfaces

Built as a private fan project for two players. Not for distribution.
