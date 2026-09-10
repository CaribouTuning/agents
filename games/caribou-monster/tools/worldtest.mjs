// The region.
//
// Every other suite here checks one map, one battle, one system. This one
// checks the shape of the whole place — because a world made entirely of
// correct maps can still be a corridor, and that is exactly what this one was.
//
// The test that matters most is the last one: the region has to contain a
// loop. A tree of maps is a set of dead ends with a town at each; a ring is a
// place you can go round.
import { MAPS } from '../src/data/maps/index.js';
import {
  WORLD_POS, worldGraph, reachableFrom, linksOf, branchiness, directionHolds,
  OPPOSITE, edgeOf, worldBounds,
} from '../src/data/maps/world.js';
import { SHINY_ODDS, createMonster, serializeMonster, reviveMonster } from '../src/game/monster.js';
import { createGameState, serializeState, deserializeState } from '../src/game/state.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const g = worldGraph();

// ---- 1. every outdoor place is on the map ----------------------------------
{
  // Sub-areas — a park or a marsh behind a gate — are reached through a door
  // rather than off a road, so they are not places on the region map.
  const outdoor = Object.values(MAPS).filter((m) => m.kind !== 'indoor' && !m.subArea);
  const missing = outdoor.filter((m) => !WORLD_POS[m.id]);
  check(missing.length === 0, 'every outdoor map has a place in the region',
    missing.map((m) => m.id).join(', '));
  const ghosts = Object.keys(WORLD_POS).filter((id) => !MAPS[id]);
  check(ghosts.length === 0, 'and nothing has a place but no map', ghosts.join(', '));
  check(g.ids.length >= 18, 'the region has somewhere to go', `${g.ids.length} places`);
}

// ---- 2. travel is two-way ----------------------------------------------------
console.log('\n--- travel is two-way ---');
{
  let broken = 0;
  for (const id of g.ids) {
    for (const [dir, to] of linksOf(id)) {
      const backs = linksOf(to).filter(([, t]) => t === id);
      if (MAPS[id].scriptEntry) continue;
      if (!backs.length || !backs.some(([d]) => d === OPPOSITE[dir])) broken++;
    }
  }
  check(broken === 0, 'every road can be walked in both directions', `${broken} that cannot`);

  let wrongWay = 0;
  for (const id of g.ids) {
    for (const [dir, to] of linksOf(id)) {
      if (!directionHolds(dir, g.nodes[id], g.nodes[to])) wrongWay++;
    }
  }
  check(wrongWay === 0, 'and walking north never takes you south', `${wrongWay} that do`);
}

// ---- 3. the region is not a corridor -------------------------------------------
console.log('\n--- it is a region, not a road ---');
{
  const junctions = g.ids.filter((id) => branchiness(id) >= 3);
  check(junctions.length >= 3, 'several places have three or more ways out',
    junctions.join(', '));

  const dirs = new Set();
  for (const id of g.ids) for (const [d] of linksOf(id)) dirs.add(d);
  for (const d of ['north', 'south', 'east', 'west']) {
    check(dirs.has(d), `something in the region leads ${d}`);
  }

  // The old world: every single link ran north or south. If that ever comes
  // back, this is the check that says so.
  const eastWest = g.ids.reduce((n, id) => n + linksOf(id).filter(([d]) => d === 'east' || d === 'west').length, 0);
  check(eastWest >= 6, 'and a real share of the roads run east and west', `${eastWest} of them`);

  // Dead ends are good — a side branch worth walking to is a dead end. What is
  // bad is a region made of nothing else.
  const deadEnds = g.ids.filter((id) => branchiness(id) === 1);
  check(deadEnds.length >= 2, 'there are places you go to and come back from',
    deadEnds.join(', '));
  check(deadEnds.length <= g.ids.length / 3, 'but the region is not mostly cul-de-sacs',
    `${deadEnds.length} of ${g.ids.length}`);
}

// ---- 4. the loop ------------------------------------------------------------------
console.log('\n--- the ring ---');
{
  // A ring means there are two different ways between two places. Walk from
  // Jubilife to Eterna without ever using the road you came in on and see
  // whether you can get back to Jubilife a different way.
  const path = (from, to, banned) => {
    const seen = new Set([from]);
    const queue = [[from, [from]]];
    while (queue.length) {
      const [at, trail] = queue.shift();
      if (at === to) return trail;
      for (const [, next] of linksOf(at)) {
        if (seen.has(next)) continue;
        if (banned && banned.has(`${at}>${next}`)) continue;
        seen.add(next);
        queue.push([next, [...trail, next]]);
      }
    }
    return null;
  };

  const there = path('jubilife', 'oreburgh');
  check(!!there, 'you can get from Jubilife to Oreburgh', there ? there.join(' -> ') : 'no way');

  // Now ban every step of that route and try again. If a second route exists,
  // the region contains a ring.
  const banned = new Set();
  for (let i = 0; i < there.length - 1; i++) {
    banned.add(`${there[i]}>${there[i + 1]}`);
    banned.add(`${there[i + 1]}>${there[i]}`);
  }
  const back = path('jubilife', 'oreburgh', banned);
  check(!!back, 'and there is a second, different way round', back ? back.join(' -> ') : 'no ring');
  check(back && back.length > there.length, 'the long way round really is longer',
    back ? `${there.length} vs ${back.length}` : '');
}

// ---- 5. you can walk to all of it ---------------------------------------------------
console.log('\n--- all of it is walkable ---');
{
  const reach = reachableFrom('twinleaf');
  const stranded = g.ids.filter((id) => !reach.has(id)
    && g.nodes[id].kind !== 'underground'
    && !MAPS[id].scriptEntry);
  check(stranded.length === 0, 'everywhere can be walked to from Twinleaf', stranded.join(', '));

  // And no two places share a square, or the Town Map draws one on the other.
  const seen = new Map();
  let clashes = 0;
  for (const id of g.ids) {
    const k = `${g.nodes[id].x},${g.nodes[id].y}`;
    if (seen.has(k)) clashes++;
    seen.set(k, id);
  }
  check(clashes === 0, 'and no two places sit on the same square', String(clashes));

  const b = worldBounds();
  check(b.maxX > b.minX && b.maxY > b.minY, 'the region has width and height',
    `${b.maxX - b.minX + 1} x ${b.maxY - b.minY + 1}`);
}

// ---- 6. edge warps are marked -----------------------------------------------------
console.log('\n--- doors and roads ---');
{
  const unmarked = [];
  for (const map of Object.values(MAPS)) {
    if (map.kind === 'indoor' || map.subArea) continue;
    for (const w of map.warps) {
      const t = MAPS[w.to];
      if (edgeOf(map, w) && t && t.kind !== 'indoor' && !t.subArea && !w.edge) {
        unmarked.push(`${map.id}@${w.x},${w.y}`);
      }
    }
  }
  check(unmarked.length === 0, 'every road out of a map is marked as one', unmarked.join(', '));

  // Interior doors must NOT be edge links, or a house would appear in the
  // region as somewhere you can walk to overland.
  const houses = g.ids.filter((id) => MAPS[id].kind === 'indoor');
  check(houses.length === 0, 'and no interior is a place on the region map', houses.join(', '));
}

// ---- 7. the towns are still towns ---------------------------------------------------
console.log('\n--- what was already there ---');
{
  // The point of this rebuild was to keep everything that worked. These are
  // the places the story happens in; if any of them went missing, say so.
  for (const id of ['twinleaf', 'sandgem', 'jubilife', 'oreburgh', 'route201',
    'route202', 'route203', 'route207', 'oreburgh_gate', 'everlight_chamber',
    'underground']) {
    check(!!MAPS[id], `${id} is still in the world`);
  }
  for (const id of ['rowan_lab', 'player_house', 'oreburgh_gym', 'oreburgh_hall',
    'sandgem_daycare', 'secret_base']) {
    check(!!MAPS[id], `${id} is still in the world`);
  }
  // And the new ones arrived.
  for (const id of ['lake_verity', 'route204', 'ravaged_path', 'floaroma',
    'route205', 'windworks', 'eterna_forest', 'eterna', 'route206', 'eterna_gym']) {
    check(!!MAPS[id], `${id} is new and present`);
  }
}

// ---- 8. shiny is rolled once and kept forever -----------------------------------------
console.log('\n--- shiny ---');
{
  check(SHINY_ODDS === 4096, 'the odds are the series’ own', `1/${SHINY_ODDS}`);

  const shiny = createMonster(387, 20, { shiny: true });
  const dull = createMonster(387, 20, { shiny: false });
  check(shiny.shiny === true && dull.shiny === false, 'shiny is a fact about a Pokémon, not a die roll');

  // Reading it a thousand times does not change it.
  let same = true;
  for (let i = 0; i < 1000; i++) if (shiny.shiny !== true) same = false;
  check(same, 'and reading it never re-rolls it');

  const back = reviveMonster(JSON.parse(JSON.stringify(serializeMonster(shiny))));
  check(back.shiny === true, 'it survives a save');

  // Through the whole state, party and box alike.
  const st = createGameState({ name: 'Matthew' });
  st.party.push(createMonster(393, 15, { shiny: true }));
  st.boxes[0].mons.push(createMonster(399, 8, { shiny: true }));
  const revived = deserializeState(JSON.parse(JSON.stringify(serializeState(st))));
  check(revived.party[0].shiny === true, 'in the party');
  check(revived.boxes[0].mons[0].shiny === true, 'and in a box');

  // Rare, but not impossible: a big sample should land in the right ballpark.
  let n = 0;
  for (let i = 0; i < 200000; i++) if (createMonster(399, 5).shiny) n++;
  const rate = n / 200000;
  check(rate > 0 && rate < 1 / 800, 'and it is genuinely rare',
    `${n} in 200000 (1 in ${Math.round(1 / (rate || 1))})`);
}

console.log(fails === 0 ? '\nworld: all checks passed' : `\nworld: ${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
