// The test-mode console.
//
// This is the tool the game is going to be exercised with from here on, so
// it needs to be at least as trustworthy as the things it is used to test.
// Every command is driven against a real game state with a stub world, and
// the chapter jump is checked against the campaign spine rather than
// against a copy of it.
import { createGameState } from '../src/game/state.js';
import { runCommand, chapterState, playableChapters, spawnPointFor, COMMANDS } from '../src/game/testmode.js';
import { MAPS } from '../src/data/maps/index.js';
import { BEATS, GYMS } from '../src/data/campaign.js';
import { tileDef } from '../src/render/tiles.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? `  ${extra}` : ''}`);
  if (!ok) fails++;
};

/** A game object with just enough world for the commands that move you. */
function makeGame() {
  const state = createGameState({ name: 'Matthew', look: 'matthew' });
  const loads = [];
  return {
    state,
    loads,
    overworld: {
      world: {
        load(map, x, y, dir) {
          loads.push({ map, x, y, dir });
          state.player.map = map; state.player.x = x; state.player.y = y; state.player.dir = dir;
        },
      },
    },
  };
}

console.log('--- the console answers ---');
{
  const g = makeGame();
  check(runCommand(g, '/help').ok && runCommand(g, '/help').text.includes('/warp'),
    'help lists the commands');
  check(!runCommand(g, '/nonsense').ok, 'an unknown command is refused');
  check(!runCommand(g, '').ok, 'an empty line is refused');
  check(runCommand(g, 'help').ok, 'the leading slash is optional');
  check(runCommand(g, '/WHERE').ok, 'commands are case-insensitive');
  check(COMMANDS.every(([c, d]) => c && d), 'every command is documented');
}

console.log('\n--- going places ---');
{
  const g = makeGame();
  const r = runCommand(g, '/warp celestic');
  check(r.ok && g.state.player.map === 'celestic', 'warp with no coordinates works', r.text);
  const spot = { x: g.state.player.x, y: g.state.player.y };
  const d = tileDef(MAPS.celestic.tiles[spot.y][spot.x]);
  check(d && !d.solid, 'and it lands somewhere you can stand', `${spot.x},${spot.y} = ${d && d.name}`);

  check(runCommand(g, '/warp celestic 12 10').ok && g.state.player.x === 12 && g.state.player.y === 10,
    'warp with coordinates works');
  check(!runCommand(g, '/warp nowhere_at_all').ok, 'warping to a map that does not exist is refused');
  check(!runCommand(g, '/warp').ok, 'warping to nothing is refused');
  check(runCommand(g, '/maps celestic').text.includes('celestic'), 'maps can be searched');

  // Every map in the game has to be reachable by the console, or the console
  // is not actually a way to test the game.
  const unreachable = Object.keys(MAPS).filter((id) => !spawnPointFor(id));
  check(unreachable.length === 0, 'every map has a spawn point', unreachable.slice(0, 6).join(', '));
}

console.log('\n--- jumping through the story ---');
{
  for (const b of playableChapters()) {
    const snap = chapterState(b.flag);
    const idx = BEATS.findIndex((x) => x.flag === b.flag);
    const earlier = BEATS.slice(0, idx).every((x) => snap.flags[x.flag]);
    check(earlier && snap.flags[b.flag], `chapter ${b.flag} implies every beat before it`);
  }
  const g = makeGame();
  const r = runCommand(g, '/chapter badge5');
  check(r.ok, 'jumping to the fifth badge works', r.text);
  check(g.state.badges.length === 5, 'and it awards exactly five badges', String(g.state.badges.length));
  check(g.state.party.length > 0 && g.state.party[0].level >= 30,
    'with a party that could survive being there', String(g.state.party[0] && g.state.party[0].level));
  check(g.state.player.map === 'pastoria_gym', 'and it puts you where the beat happens', g.state.player.map);
  check(g.state.flags.badge1 && g.state.flags.badge4 && g.state.flags.lakeValor === undefined,
    'earlier beats are set and later ones are not');

  // Badges as a list and badges as flags are two representations of one
  // fact, and a chapter that sets one without the other is a broken save.
  for (const b of playableChapters()) {
    const snap = chapterState(b.flag);
    const agree = GYMS.every((gym) => !!snap.flags[`badge${gym.n}`] === snap.badges.includes(gym.n));
    check(agree, `chapter ${b.flag} keeps badges and badge flags in step`);
  }
  check(!runCommand(makeGame(), '/chapter not_a_beat').ok, 'an unknown beat is refused');
}

console.log('\n--- handing things out ---');
{
  const g = makeGame();
  // A new game already comes with a few Potions, so this is a delta.
  const potionsBefore = g.state.inventory.items.potion || 0;
  check(runCommand(g, '/give potion 5').ok && g.state.inventory.items.potion === potionsBefore + 5,
    'items arrive', `${potionsBefore} -> ${g.state.inventory.items.potion}`);
  check(!runCommand(g, '/give notanitem').ok, 'unknown items are refused');
  check(runCommand(g, '/mon turtwig 40').ok && g.state.party.some((m) => m.level === 40),
    'a Pokémon can be added by name');
  check(runCommand(g, '/mon 025 12').ok, 'and by dex number');
  check(!runCommand(g, '/mon notamon').ok, 'an unknown Pokémon is refused');
  check(runCommand(g, '/shiny').ok && g.state.party[0].shiny, 'the lead can be made shiny');
  check(runCommand(g, '/level 55').ok && g.state.party.every((m) => m.isEgg || m.level === 55),
    'the party can be levelled');
  check(runCommand(g, '/badges').ok && g.state.badges.length === GYMS.length, 'all badges can be awarded');
  check(runCommand(g, '/hms').ok, 'all HMs can be handed over');
  check(runCommand(g, '/money 4321').ok && g.state.inventory.money === 4321, 'money can be set');
  check(runCommand(g, '/heal').ok, 'the party can be healed');
  check(runCommand(g, '/dex').ok && Object.keys(g.state.dex.caught).length > 100, 'the dex can be filled');
}

console.log('\n--- flags ---');
{
  const g = makeGame();
  check(runCommand(g, '/flag celestic').ok && g.state.flags.celestic === true, 'a flag can be set');
  check(runCommand(g, '/flag celestic off').ok && g.state.flags.celestic === false, 'and cleared');
  check(runCommand(g, '/flags celes').text.includes('celestic'), 'flags can be searched');
  check(!runCommand(g, '/flag').ok, 'setting nothing is refused');
}

console.log(fails ? `\n${fails} failure(s)` : '\ntest mode: all checks passed');
process.exit(fails ? 1 : 0);
