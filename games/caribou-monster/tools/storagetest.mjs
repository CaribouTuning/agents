// Five to a team, and somewhere to put the rest.
//
// The party cap and the boxes are one feature, not two: the cap is only
// bearable because nothing you catch is ever thrown away, and the boxes only
// matter because the cap is real. So they are tested together.
import { createGameState, serializeState, deserializeState, receiveMonster,
  addToParty, partyToBox, boxToParty, releaseFromBox, findMonByUid,
  MAX_PARTY, BOX_COUNT, BOX_SIZE } from '../src/game/state.js';
import { createMonster } from '../src/game/monster.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const fresh = () => createGameState({ look: 'matthew', name: 'Matt' });
const mon = (n) => createMonster(387, 5 + n);

console.log('--- five to a team ---');
check(MAX_PARTY === 5, 'a party holds five', `MAX_PARTY=${MAX_PARTY}`);
{
  const st = fresh();
  st.party = [];
  for (let i = 0; i < MAX_PARTY; i++) check(addToParty(st, mon(i)), `number ${i + 1} joins the team`);
  check(!addToParty(st, mon(9)), 'the sixth is turned away');
  check(st.party.length === MAX_PARTY, 'and the team is still five');
}

console.log('\n--- the overflow goes to a box, not to nowhere ---');
{
  const st = fresh();
  st.party = [];
  for (let i = 0; i < MAX_PARTY; i++) addToParty(st, mon(i));
  const extra = mon(6);
  const dest = receiveMonster(st, extra);
  check(dest && dest.where === 'box', 'catching a sixth puts it in a box', dest && dest.boxName);
  check(!!findMonByUid(st, extra.uid), 'and it can be found again by name');
  check(st.boxes[0].mons.length === 1, 'it is in the first box with room');
}

console.log('\n--- the boxes hold everything a long game can catch ---');
{
  const st = fresh();
  check(st.boxes.length === BOX_COUNT, `there are ${BOX_COUNT} boxes`);
  const room = BOX_COUNT * BOX_SIZE;
  check(room >= 200, 'with room for a whole playthrough', `${room} places`);
  st.party = [mon(1)];
  let stored = 0;
  for (let i = 0; i < room + MAX_PARTY - 1; i++) if (receiveMonster(st, mon(i % 20))) stored++;
  check(stored === room + MAX_PARTY - 1, 'and nothing is dropped on the way in', `${stored} kept`);
  check(receiveMonster(st, mon(1)) === null, 'only once every last place is taken is one refused');
}

console.log('\n--- moving them about ---');
{
  const st = fresh();
  st.party = [mon(1), mon(2)];
  const going = st.party[1];
  check(partyToBox(st, 1, 0), 'you can send one to a box');
  check(st.party.length === 1 && st.boxes[0].mons[0] === going, 'and it is in the box, not in both places');
  check(!partyToBox(st, 0, 0), 'but never your last one — that would leave you with nothing');
  check(boxToParty(st, 0, 0), 'you can take one back out');
  check(st.party.length === 2 && st.boxes[0].mons.length === 0, 'and the box is empty again');
  while (st.party.length < MAX_PARTY) addToParty(st, mon(3));
  st.boxes[0].mons.push(mon(4));
  check(!boxToParty(st, 0, 0), 'and a full team cannot take another out');
  const let_go = releaseFromBox(st, 0, 0);
  check(!!let_go && st.boxes[0].mons.length === 0, 'releasing one takes it out of the box');
}

console.log('\n--- and all of it survives the save ---');
{
  const st = fresh();
  st.party = [mon(1)];
  const kept = mon(7);
  kept.nickname = 'Wanda';
  st.boxes[3].mons.push(kept);
  st.boxes[3].name = 'THE LAKE ONES';
  const back = deserializeState(JSON.parse(JSON.stringify(serializeState(st))));
  check(back.boxes[3].mons.length === 1, 'a boxed monster is still there after a reload');
  check(back.boxes[3].mons[0].nickname === 'Wanda', 'with the name you gave it');
  check(back.boxes[3].name === 'THE LAKE ONES', 'and the box keeps the name you gave it');
  const over = fresh();
  over.party = [mon(1), mon(2), mon(3), mon(4), mon(5), mon(6), mon(7)];
  const trimmed = deserializeState(JSON.parse(JSON.stringify(serializeState(over))));
  check(trimmed.party.length === MAX_PARTY, 'an old save carrying six is trimmed to five on load',
    `${trimmed.party.length}`);
}

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
