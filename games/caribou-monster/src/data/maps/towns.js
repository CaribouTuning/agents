import { defineMap } from './define.js';
import { TILES } from '../../render/tiles.js';

const TWINLEAF_ROWS = [
  'TTTTTTTTTT::TTTTTTTTTT',
  'T.........::.........T',
  'T.GGGGG...::.........T',
  'T.GGGGG...::.........T',
  'T.VVVVV...::.........T',
  'T.#WDW#...::.........T',
  'T...:.....::.........T',
  'T...::::::::::::::...T',
  'T.........::.........T',
  'T.AAAAA...::.BBBBB...T',
  'T.AAAAA...::.BBBBB...T',
  'T.VVVVV...::.VVVVV...T',
  'T.#WDW#...::.#WDW#...T',
  'T...:.....::...:.....T',
  'T...::::::::::::::...T',
  'T..S..OOO.::.......S.T',
  'T.........::.........T',
  'TTTTTTTTTTTTTTTTTTTTTT',
];

export const TWINLEAF = defineMap('twinleaf', {
  name: 'Twinleaf Town', kind: 'town', music: 'town',
  tiles: TWINLEAF_ROWS,

  // The other one is on the step, and the scene fires the moment you come out
  // of your own front door.
  //
  // It used to sit on the path row below the houses, on the reasoning that
  // arriving on a tile is not the same as stepping onto it — which is true,
  // and was the wrong fix. The lab is NORTH of both houses, so nobody ever
  // walked south onto that row: Mum said the other one was outside, you came
  // out, and there was nobody there. An `arrive` event fires on the tile you
  // land on, which is the doorstep, which is where they are standing.
  events: [
    { x: 4, y: 13, arrive: true, flag: 'buddyJoined', requires: 'mumSentYouOff', script: 'buddyWaiting' },
    { x: 15, y: 13, arrive: true, flag: 'buddyJoined', requires: 'mumSentYouOff', script: 'buddyWaiting' },
    // Home, after. The cool-down: it fires the moment you come back into
    // Twinleaf once Rowan has finished outside the Gate, whichever road you
    // walk in on, so the end of the story cannot be missed by arriving from
    // the wrong direction.
    { x: 10, y: 1, arrive: true, flag: 'wentHome', requires: 'rowanDebriefed', script: 'wentHome' },
    { x: 11, y: 1, arrive: true, flag: 'wentHome', requires: 'rowanDebriefed', script: 'wentHome' },
    // And a backstop across the path below, in case somebody walks out, walks
    // away, and comes back before the scene has happened.
    ...TWINLEAF_ROWS[7].split('').map((ch, x) => (
      TILES[ch] && !TILES[ch].solid
        ? { x, y: 7, flag: 'wentHome', requires: 'rowanDebriefed', script: 'wentHome' }
        : null
    )).filter(Boolean),
    ...TWINLEAF_ROWS[14].split('').map((ch, x) => (
      TILES[ch] && !TILES[ch].solid
        ? { x, y: 14, flag: 'buddyJoined', requires: 'mumSentYouOff', script: 'buddyWaiting' }
        : null
    )).filter(Boolean),
  ],
  warps: [
    // Shut until Rowan has handed a Pokemon over. You can wander the whole
    // town, go in every house and talk to everybody — the one thing you
    // cannot do is walk into tall grass with nothing to send out.
    { x: 10, y: 0, to: 'route201', tx: 12, ty: 26, dir: 'up', edge: true,
      requires: 'gotStarter',
      refuse: 'There is tall grass past the sign, and nothing in your bag but a\nphone.\fGo and see Professor Rowan first.' },
    { x: 11, y: 0, to: 'route201', tx: 13, ty: 26, dir: 'up', edge: true,
      requires: 'gotStarter',
      refuse: 'There is tall grass past the sign, and nothing in your bag but a\nphone.\fGo and see Professor Rowan first.' },
    { x: 4, y: 12, to: 'matthew_house', tx: 5, ty: 6, dir: 'up' },
    { x: 15, y: 12, to: 'sammy_house', tx: 5, ty: 6, dir: 'up' },
    { x: 4, y: 5, to: 'rowan_lab', tx: 6, ty: 7, dir: 'up' },
  ],
  labels: [
    { x: 2, y: 4, w: 5, text: "ROWAN'S LAB" },
  ],
  signs: [
    { x: 3, y: 15, text: 'TWINLEAF TOWN\n"Fresh and free!"\nThree buildings and one road out of it.' },
    { x: 19, y: 15, text: 'ROUTE 201 — NORTH\nTall grass ahead. Wild Pokémon live in it.\nDo not walk in without a Pokémon.' },
  ],
  npcs: [
    // Bandit. Sammy's dog, and she has opinions about who she belongs to.
    {
      id: 'tw_bandit', x: 16, y: 13, species: 228, name: 'Bandit',
      movement: 'lookAround', facing: 'up',
      // Once she has joined the party she is walking behind somebody, not
      // sitting on the step. Rowan announcing she has joined while she is
      // visibly still outside is the kind of thing that breaks a world.
      goneWhen: 'banditWithUs',
      dialogue: [
        {
          when: { playing: 'sammy' },
          lines: ['Bandit: *She hits you at knee height before you have finished\nshutting the door.*',
            '*She is not going to be talked out of coming.*'],
        },
        {
          lines: ['Bandit: *She looks past you, at the other house, and then back.*',
            '*She is Sammy’s dog and she has never pretended otherwise.*',
            '*She lets you scratch her ears anyway.*'],
        },
      ],
    },
    {
      // Tam is the town's circuit superfan. Whoever is actually top of the
      // world ranking is who he has posters of — including, eventually, you.
      id: 'bv_kid', x: 8, y: 8, look: 'kid', name: 'Tam', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { champion: true },
          pool: [
            ['{player}. {player}! You are number one in the WORLD.',
              'I had {topPro} posters up for years and now the posters are YOU.',
              'I told everyone. I told the whole town. Nobody believed me.'],
            ['Can I see {lead}? Just for a second? I will not touch it.',
              'My mum says I talk about you too much. My mum is wrong.'],
            ['Rating {rating}. Rating {rating}! I check it every single day.',
              'Do not lose. If you lose I have to change all my notebooks.'],
          ],
        },
        {
          when: { all: [{ linked: true }, { joined: true }] },
          lines: ['TWO of you? {partner} is out there RIGHT NOW as well?',
            'That is a link-up. That is a real sanctioned link-up.',
            'You have to battle. You have to. I will wait here. I have nothing else on.'],
        },
        {
          when: { topTen: true },
          pool: [
            ['You are number {place} in the world! Number {place}!',
              '{champion} is still number one, but you are RIGHT THERE.',
              'Do you think you could beat them? Do you? Be honest.'],
            ['I have a notebook with every result on the circuit in it.',
              'You are on page four now. {champion} is on page one. For now.'],
          ],
        },
        {
          when: { joined: true },
          pool: [
            ['You joined the CIRCUIT? The actual circuit?!',
              '{champion} is the best trainer alive. Everybody knows that. They call them "{championTag}".',
              'If you ever meet them, say Tam from Twinleaf says hello.'],
            ['{rank}, right? That is what the board said.',
              'Everyone starts at Rookie. Even {champion} did. I looked it up.'],
            ['They say {rival} is going to be the next big one.',
              'I said "no, my friend from Twinleaf is". They laughed at me.'],
          ],
        },
        {
          when: { badges: 1 },
          lines: ['You beat Roark?! With {lead}?!',
            'There is a Battle Hall in Oreburgh where the proper trainers go. The world circuit ones.',
            '{champion} has won everything there is. I have a poster.'],
        },
        {
          when: { flag: 'gotStarter' },
          pool: [
            ['Professor Rowan gave you a {starter}?! Lucky!',
              'Mum says the grass past the town is full of Starly. I am not allowed up there yet.'],
            ['Is it true there are two of you? You and {buddy}?',
              'Somebody said you both got a Pokémon off Rowan on the same morning.',
              'That is a RIVALRY. That is what that is. I am writing it down.'],
            ['Is that a HOUNDOUR? An actual Houndour, just walking about?',
              'They are supposed to be really hard to get near. My book says so.',
              'She is not even on a lead. She just... goes where you go.'],
            ['When {buddy} links up with you, come and find me first.',
              'I want to see it. A real link-up. Two trainers, one world.',
              'I will not get in the way. I will stand exactly here.'],
          ],
        },
        {
          lines: ['Professor Rowan is handing out Pokémon today. Actual ones.',
            'I am too young. I asked. Twice.'],
        },
      ],
    },
    {
      // She keeps the beds at the end of the lane, and she has decided the two
      // of you are going to keep one too.
      id: 'bv_gardener', x: 9, y: 15, look: 'mom', name: 'Nel', movement: 'still', facing: 'left',
      script: 'berryGift',
      dialogue: [
        { lines: ['Soft soil, that. Anything goes in it.'] },
      ],
    },
    {
      id: 'bv_oldman', x: 17, y: 15, look: 'oldMan', name: 'Hollis', movement: 'lookAround', facing: 'left',
      dialogue: [
        {
          when: { flag: 'caughtEverlight' },
          lines: ['The sky went out.',
            'Sixty years of watching it, and last night there was simply nothing there.',
            'Whatever you brought back up out of that hill — look after it.',
            'It was here a long time before Twinleaf was.'],
        },
        {
          when: { flag: 'everlightOpened' },
          lines: ['You found the seam, then. I can see it on you.',
            'The aurora has been brighter since. Not worse. Brighter.',
            'I do not know which of those is the good news.'],
        },
        {
          when: { flag: 'beatCommander' },
          lines: ['You went into the Gate and came back out. Not everyone does.',
            'The light has settled since. Not gone. Settled.',
            'Sixty years I have watched that sky. It is waiting for something.'],
        },
        {
          when: { flag: 'enteredCave' },
          lines: ['You have been in Oreburgh Gate. I can tell — you have got that look.',
            'The coats have been going in and out of there for a month.',
            'Whatever is under that hill, it was there before the town was.'],
        },
        {
          when: { badges: 1 },
          lines: ['A badge already. The road agrees with you.',
            'The aurora is still coming this far south. Three nights running, then four, then five.',
            'Ask the scientist in Oreburgh. She reads more than she lets on.'],
        },
        {
          lines: ['Sixty years I have lived in Twinleaf, and the aurora has never once come this far south.',
            'Lately though? Three nights running. Something is stirring up north.'],
        },
      ],
    },
    {
      id: 'bv_woman', x: 18, y: 8, look: 'mom', name: 'Bev', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { caught: 15 },
          lines: ['{caught} caught and {seen} seen. In a town this size that is practically famous.',
            'My nephew managed four and would not stop talking about it.'],
        },
        {
          when: { badges: 1 },
          lines: ['Word came down the road that you took the Oreburgh badge.',
            'Twinleaf does not produce many trainers. It produces stories about them.'],
        },
        {
          lines: ['If your Pokémon get tired, the Pokémon Center in Oreburgh will patch them up free of charge.',
            'Just walk up to the counter and say yes.'],
        },
      ],
    },
    {
      // The other half of the fan conversation: someone who has been following
      // the circuit long enough to be unimpressed by it.
      id: 'bv_postman', x: 6, y: 16, look: 'worker', name: 'Postman', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { titles: 1 },
          lines: ['Two letters for you this week, both from Oreburgh.',
            'One is from the Battle Hall. The other is a child asking for your autograph.',
            'That is how it starts. Next it will be sacks of them.'],
        },
        {
          when: { linked: true },
          lines: ['Two of you on the road at once. I have seen {partner} go past this week.',
            'That is double the post and I am not being paid double.',
            'I do not mind. It is nice, having two of you at it.'],
        },
        {
          when: { joined: true },
          lines: ['You are on the circuit register now. I deliver the results sheet every Monday.',
            'Tam has me hold his copy at the counter so he can be first to read it.'],
        },
        {
          lines: ['Twinleaf gets four deliveries a week and three of them are for the lab.',
            'Professor Rowan orders more paper than the whole of Oreburgh.'],
        },
      ],
    },
  ],
  // No town-level heal point: the two houses carry their own, and which one
  // is yours depends on which of them you are. `state.lastHealPoint` is set
  // from the player record when the game starts.

});

export const OREBURGH = defineMap('oreburgh', {
  name: 'Oreburgh City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTTT;;TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT;;TTTTTTTTTTTTTTTT',
    'T.............;;...............T',
    'T..AAAAAAAA...;;.....BBBBBBBB..T',
    'T..AAAAAAAA...;;.....BBBBBBBB..T',
    'T..VVVVVVVV...;;.....VVVVVVVV..T',
    'T..#WFFDFFW#..;;.....#WJJDJJW#.T',
    'T......;......;;........;......T',
    ';;;;;;;;;;;;;;;;;;;;;;;;;;.....T',
    ';.............;;..EEEEEEEE.....T',
    'T....*........;;..EEEEEEEE.....T',
    'T.............;;..#WWDDWW#.....T',
    'T..GGGGG......;;.S.............T',
    'T..GGGGG......;;........GGGGG..T',
    'T..#WDW#......;;........#WDW#..T',
    'T....;....KKKKKKKKKK......;....T',
    'T....;....KKKKKKKKKK......;....T',
    'T....;....KKKKKKKKKK......;....T',
    'T....;....VVVVVVVVVV......;....T',
    'T....;....NQNNddNNQN......;....T',
    'T....;....I.S.;;.S.I......;....T',
    'T....;;;;;;;;;;;;;;;;;;;;;;....T',
    'T.............;;...............T',
    'T..S..........;;..........S....T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],

  warps: [
    { x: 14, y: 0, to: 'route207', tx: 12, ty: 16, dir: 'up', edge: true },
    { x: 15, y: 0, to: 'route207', tx: 13, ty: 16, dir: 'up', edge: true },
    { x: 0, y: 8, to: 'route203', tx: 32, ty: 7, dir: 'left', edge: true },
    { x: 0, y: 9, to: 'route203', tx: 32, ty: 8, dir: 'left', edge: true },
    { x: 7, y: 6, to: 'oreburgh_center', tx: 6, ty: 6, dir: 'up' },
    { x: 25, y: 6, to: 'oreburgh_mart', tx: 5, ty: 5, dir: 'up' },
    { x: 5, y: 14, to: 'oreburgh_house', tx: 5, ty: 6, dir: 'up' },
    { x: 26, y: 14, to: 'oreburgh_house2', tx: 5, ty: 6, dir: 'up' },
    { x: 14, y: 19, to: 'oreburgh_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 15, y: 19, to: 'oreburgh_gym', tx: 8, ty: 14, dir: 'up' },
    { x: 21, y: 11, to: 'oreburgh_hall', tx: 7, ty: 8, dir: 'up' },
    { x: 22, y: 11, to: 'oreburgh_hall', tx: 8, ty: 8, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 5, w: 8, text: 'POKéMON CENTER' },
    { x: 21, y: 5, w: 8, text: 'POKéMON MART' },
    { x: 10, y: 18, w: 10, text: 'OREBURGH GYM', tone: '#f8e070' },
  ],
  events: [
    // The survey Ines keeps talking about, left on the bench beside her.
    { x: 20, y: 21, flag: 'doc_survey_read', script: 'docSurvey' },
    // Cass, the second time, on the road in from Route 203 — the road the
    // story actually brings you down. The scene was written and placed on no
    // map at all, so the second rival battle simply never happened.
    { x: 3, y: 8, flag: 'beatRival2', requires: 'beatRival1', script: 'rival2' },
    { x: 3, y: 9, flag: 'beatRival2', requires: 'beatRival1', script: 'rival2' },
    { x: 4, y: 8, flag: 'beatRival2', requires: 'beatRival1', script: 'rival2' },
    { x: 4, y: 9, flag: 'beatRival2', requires: 'beatRival1', script: 'rival2' },
  ],
  signs: [
    { x: 3, y: 23, text: 'OREBURGH CITY\n"The City of Energy"\nCut from the hillside, stone by stone.' },
    { x: 26, y: 23, text: 'OREBURGH CITY\nGYM ahead — south end of the main road.\nBATTLE HALL — east side.' },
    { x: 17, y: 12, text: 'OREBURGH BATTLE HALL\nSanctioned venue of the World Circuit.\nOpen entry. Bring a team.' },
    { x: 12, y: 20, text: 'OREBURGH GYM\nLeader: ROARK\nThe Rock-type Pokémon user!\n"The quarry does not blink."' },
    { x: 17, y: 20, text: 'WIN AND CLAIM THE COAL BADGE\nA Gym Badge is proof you beat a Leader.\n{leagueBadges} of them opens the League.' },
  ],
  npcs: [
    {
      id: 'al_clerkgirl', x: 10, y: 9, look: 'lass', name: 'Odie', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { inEvent: true },
          lines: ['The Hall is packed. Are you not supposed to be IN there?',
            'They will not hold the floor forever, you know.'],
        },
        {
          when: { joined: true },
          pool: [
            ['On event days the queue for the Battle Hall goes past the Mart.',
              'Half of them cannot get in. They stand outside and listen to the announcer anyway.'],
            ['You are on the register at the Hall now, are you not? I saw the sheet.',
              'Rating {rating}. That is a real number on a real board.'],
          ],
        },
        {
          lines: ['The red roof is the Pokémon Center and the blue one is the Mart. Everybody mixes them up once.',
            'Only once, though. The Mart does not heal anything.'],
        },
      ],
    },
    {
      id: 'al_worker', x: 20, y: 13, look: 'worker', name: 'Dell', movement: 'lookAround', facing: 'left',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['So you took the badge off Roark. He will be down the quarry sulking about it.',
            'He does that. Then he comes back better. Twice now I have watched him do it.'],
        },
        {
          lines: ['Roark runs the gym and the quarry both. Rock types, obviously.',
            'Grass and Water tear straight through rock. That is not a secret, it is just true.'],
        },
      ],
    },
    {
      id: 'al_scientist', x: 19, y: 21, look: 'scientist', name: 'Ines', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'caughtEverlight' },
          lines: ['It is in a ball. You are carrying it around in a ball.',
            'Ninety years of survey notes and a word nobody could source, and it fits in a ball.',
            'I am not being sarcastic. I have never been less sarcastic in my life.',
            'Come back when you have decided what to do with it. I will still be here.'],
        },
        {
          when: { flag: 'everlightOpened' },
          lines: ['The rock OPENED for you? The rock opened.',
            'That confirms the charm is a key and not a keepsake, which is my third theory and my worst.',
            'Whatever is down there, it was expecting somebody. Eventually.'],
        },
        {
          when: { flag: 'beatCommander' },
          lines: ['You saw it, then. The seam. The light in the rock.',
            'I found the word a third time last night, in a quarry survey from ninety years ago.',
            '"The Everlight does not sleep. It waits, and it is patient, and it is not alone."',
            'Ninety years ago somebody wrote that in a geology report. A geology report.'],
        },
        {
          when: { flag: 'enteredCave' },
          lines: ['You went into the Gate. Did the coats let you past, or did you make them?',
            'Either way. Tell me what colour the light was. It matters. I do not yet know why.'],
        },
        {
          lines: ['Team Galactic are up on Route 207 taking light readings.',
            'Odd hobby, for a group with matching coats.',
            'They keep saying "the Everlight".',
            'I have read every book in this city. The word is in two of them.'],
        },
      ],
    },
    {
      // Kip is the Hall's doorstep explainer. Everything he quotes is read
      // live off the standings, so he is never wrong about who is on top.
      id: 'al_link_watch', x: 27, y: 9, look: 'scientist', name: 'Technician', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two signals on the local link, and one of them is {partner}.',
            'That is a live session. Trade, battle, or just walk together — one link does all three.',
            'It stays up as long as you both stay in the room.'],
        },
        {
          lines: ['One signal on the local link today. Just you.',
            'When {buddy} opens LINK and joins the same room code, you both show up in one world.',
            'Same code, both phones. That is the whole trick.'],
        },
      ],
    },
    {
      id: 'al_fan', x: 18, y: 13, look: 'youngster', name: 'Kip', movement: 'still', facing: 'up',
      dialogue: [
        {
          when: { champion: true },
          lines: ['I stand outside this building every day telling people who the best trainer alive is.',
            'Today I have to say your name and it feels very strange.',
            '{titles} titles. Rating {rating}. Nobody in there is arguing with it.'],
        },
        {
          when: { titles: 1 },
          pool: [
            ['You won the {lastTitle}. I watched it on the board out here.',
              '{champion} is still number one. That is the wall everybody hits.',
              'You have not hit it yet. You have just walked up to it.'],
            ['The betting shop down the road put you at forty to one last month.',
              'They took the sign down this morning. Draw your own conclusions.'],
          ],
        },
        {
          when: { joined: true },
          pool: [
            ['{champion} — "{championTag}" — is world number one. Eleven straight seasons.',
              'Badges make you a trainer. The circuit tells you what kind.',
              'You are {rank}. Everyone is, at the start.'],
            ['Watch {rival}. Rating {rivalRating} and climbing fast.',
              'Same age as you, one season ahead. That is the one to beat.'],
            ['Circuit Points never go down. Rating goes both ways.',
              'That is why the old-timers only ever talk about points. Safer number.'],
          ],
        },
        {
          lines: ['That grey building is the Battle Hall. Sanctioned circuit events, every week.',
            'Badges make you a trainer. The circuit tells you what kind.',
            '{champion} has been world number one for eleven seasons. Eleven.'],
        },
      ],
    },
    {
      // Oreburgh is a mining town, so the man who knows about the tunnels
      // under Sinnoh lives here and has never once gone down them himself.
      id: 'al_ugman', x: 10, y: 23, look: 'oldMan', name: 'Underground Man',
      movement: 'lookAround', facing: 'down', script: 'explorerKit',
      dialogue: [
        { lines: ['There is another Sinnoh under this one.'] },
      ],
    },
    {
      id: 'al_sailor', x: 6, y: 21, look: 'sailor', name: 'Bram', movement: 'wander', facing: 'right',
      dialogue: [
        {
          when: { topTen: true },
          lines: ['You are number {place} in the world and you still walk to the Center like the rest of us.',
            'Stay like that. The ones who stop walking get strange.'],
        },
        {
          when: { linked: true },
          lines: ['You and {partner} keep passing each other in the street.',
            'Neither of you looks where you are going. Both of you look at the other one.',
            'Trainers heal free here, by the way. Both of you. Nobody has ever suggested stopping.'],
        },
        {
          when: { badges: 1 },
          lines: ['Trainers heal free here. Costs the city a fortune and nobody has ever suggested stopping.',
            'Badge on you now too. The city likes that. Good for the quarry, good for the Hall.'],
        },
        {
          lines: ['Trainers heal free here. Costs the city a fortune and nobody has ever suggested stopping.'],
        },
      ],
    },
  ],
  healPoint: { map: 'oreburgh_center', x: 6, y: 5 },
});

// ---------------------------------------------------------------------------
// Sandgem Town — the first place with a Center in it, and where the game
// teaches catching. In Platinum this is where Rowan's lab is; here the lab is
// at home in Twinleaf, so Sandgem is what it is on the map: the little coastal
// town you hit the moment you have a Pokémon and no idea what to do with it.
// ---------------------------------------------------------------------------

export const SANDGEM = defineMap('sandgem', {
  name: 'Sandgem Town', kind: 'town', music: 'town',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTTTTTTTT',
    'T...........::.................T',
    'T..AAAAAAA..::.....BBBBBB......T',
    'T..AAAAAAA..::.....BBBBBB......T',
    'T..VVVVVVV..::.....VVVVVV......T',
    'T..#WFFDFW..::.....#WJDJW......T',
    'T......:....::........:........T',
    'T......:....::........:........T',
    'T.....::::::::::::::::::::::...T',
    'T.....:.....::........:........T',
    'T..S..:.....::........:........T',
    'T.....:.....::.GGGGG..:........T',
    'T.....:.....::.GGGGG..:........T',
    'T.....:.....::.#WDW#..:........T',
    'T.....:.....::...:....:........T',
    'T.....::::::::::::::::::::::...T',
    'T...........::.......ssssssssssT',
    'T...........::.....sssssssssss.T',
    'T...........::...sssssss~~~~~~~~',
    'T..OOO......::..ssss~~~~~~~~~~~~',
    'T...........::..ss~~~~~~~~~~~~~~',
    'T..S........::..ss~~~~~~~~~~~~~~',
    'T...........::..sss............T',
    'TTTTTTTTTTTT::TTTTTTTTTTTTTTTTTT',
  ],

  warps: [
    { x: 12, y: 0, to: 'route202', tx: 12, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route202', tx: 13, ty: 22, dir: 'up', edge: true },
    { x: 12, y: 23, to: 'route201', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'route201', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 7, y: 5, to: 'sandgem_center', tx: 6, ty: 6, dir: 'up' },
    { x: 22, y: 5, to: 'sandgem_mart', tx: 5, ty: 5, dir: 'up' },
    { x: 17, y: 13, to: 'sandgem_daycare', tx: 5, ty: 6, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 7, text: 'POKéMON CENTER' },
    { x: 19, y: 4, w: 6, text: 'POKéMON MART' },
    { x: 15, y: 12, w: 5, text: 'DAY CARE', tone: '#f8e070' },
  ],
  signs: [
    { x: 3, y: 10, text: 'SANDGEM TOWN\n"Where the sand shines."\nCENTER — west. MART — east.\nROUTE 202 runs north to Jubilife.' },
    { x: 3, y: 21, text: 'THE BEACH\nThe sea goes on past the end of the map,\nwhich is more than can be said for most things.' },
  ],
  // Nothing lives in the grass in a town, but there is a sea at the bottom
  // of it, and the man on the beach will give you a rod if you ask nicely.
  encounters: {
    grass: null,
    fish: { min: 3, max: 7, table: [[129, 55], [72, 20], [456, 15], [458, 6], [349, 4]] },
  },
  npcs: [
    {
      // The catching lesson. In the DS games somebody demonstrates this at you
      // whether you want it or not, and it is the reason nobody ever had to
      // guess how a Poke Ball works.
      id: 'sg_catcher', x: 9, y: 7, look: 'youngster', name: 'Riko',
      movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { caught: 5 },
          lines: ['{caught} caught already! You have got the hang of it.',
            'Different balls have different pull. Great Balls are worth the money.'],
        },
        {
          lines: ['You have got a Pokémon but no catches yet? Right. Listen.',
            'Wild Pokémon live in the TALL GRASS. Walk in it and one will find you.',
            'Do NOT throw a ball at a healthy one.\fYou are throwing money into a hedge.',
            'Knock its HP down first. Yellow bar is better. Red bar is better still.',
            'Sleep or paralysis makes it easier again.\fThen BAG, then BALLS, then throw.',
            'That is the whole trick. Go and fill that Pokédex.'],
        },
      ],
    },
    {
      id: 'sg_fisher', x: 19, y: 18, look: 'sailor', name: 'Bram', movement: 'still', facing: 'down',
      script: 'oldRod',
      dialogue: [
        {
          // Walking back out of Route 202 is the first time most people have
          // been in tall grass with something of their own. Somebody should
          // notice.
          when: { all: [{ flag: 'enteredForest' }, { notFlag: 'badge1' }] },
          lines: ['Been up through the grass on 202 already? You have got the walk of it.',
            'Everybody comes back down that road quieter than they went up.',
            'The beach goes on for miles and the water is full of things I cannot name.'],
        },
        {
          lines: ['The beach goes on for miles and the water is full of things I cannot name.'],
        },
      ],
    },
    {
      id: 'sg_gran', x: 4, y: 12, look: 'mom', name: 'Enna', movement: 'still', facing: 'right',
      dialogue: [
        {
          when: { alone: true },
          lines: ['Travelling on your own, are you?',
            'My sister and I did this road together forty years ago.',
            'We argued the entire way.\fI would not change a minute of it.',
            'If {buddy} is out there somewhere, find a way to walk it together.'],
        },
        {
          lines: ['Two of you! Oh, that is the way to do it.',
            'You will remember this road for the rest of your lives.\fMake sure you remember it the same.'],
        },
      ],
    },
  ],
  healPoint: { map: 'sandgem_center', x: 6, y: 5 },
});

// ---------------------------------------------------------------------------
// Jubilife City — the biggest place on this stretch of road, and the one with
// the Trainers' School in it. Everything a Pokemon game needs to teach and
// cannot teach in a menu is taught in a classroom, by people, out loud. That
// is why this building exists in the real games and why it exists here.
// ---------------------------------------------------------------------------

export const JUBILIFE = defineMap('jubilife', {
  name: 'Jubilife City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTqqTTTTTTTTTTTTTTT....T',
    'T...........qq...................T',
    'T..AAAAAAAA.qq......BBBBBBBB.....T',
    'T..AAAAAAAA.qq......BBBBBBBB.....T',
    'T..VVVVVVVV.qq......VVVVVVVV.....T',
    'T..#WFFDFFW.qq......#WJJDJJW.....T',
    'T.....q.....qq..........q........T',
    'q.....qqqqqqqqqqqqqqqqqqqqqqq....q',
    'q.....q.....qq..........qqqqq....q',
    'T..S..q.....qq..........q........T',
    'T.....q.EEEEEEEEEEEE....q........T',
    'T.....q.EEEEEEEEEEEE....q........T',
    'T.....q.VVVVVVVVVVVV....q........T',
    'T.....q.#WW#WWDDWW#WW...q........T',
    'T.....q........qq.......q........T',
    'T.....qqqqqqqqqqqqqqqqqqqq.......T',
    'T..............qq................T',
    'T..hihih.......qq....hihih.......T',
    'T..hhihh.......qq....hhihh.......T',
    'T..#WDW#.......qq....#WDW#.......T',
    'T.....q........qq......q.........T',
    'T.....qqqqqqqqqqqqqqqqqq.........T',
    'T..S...........qq...........S....T',
    'T.qqqqqqqq..........qqqqqqqq.....T',
    'T.hhihhihh..........hhihhihh.....T',
    'T.#WDW#WDW..........#WDW#WDW.....T',
    'T.qq.qq.qq..........qq.qq.qq.....T',
    'TTTTTTTTTTTTqqqqqqTTTTTTTTTTT....T',
  ],



  warps: [
    { x: 12, y: 0, to: 'route204', tx: 12, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route204', tx: 13, ty: 22, dir: 'up', edge: true },
    { x: 15, y: 27, to: 'route202', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 16, y: 27, to: 'route202', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 0, y: 7, to: 'route218', tx: 29, ty: 5, dir: 'left', edge: true },
    { x: 0, y: 8, to: 'route218', tx: 29, ty: 10, dir: 'left', edge: true },
    { x: 33, y: 7, to: 'route203', tx: 1, ty: 6, dir: 'right', edge: true },
    { x: 33, y: 8, to: 'route203', tx: 1, ty: 7, dir: 'right', edge: true },
    { x: 7, y: 5, to: 'jubilife_center', tx: 6, ty: 6, dir: 'up' },
    { x: 24, y: 5, to: 'jubilife_mart', tx: 5, ty: 5, dir: 'up' },
    { x: 14, y: 13, to: 'jubilife_school', tx: 7, ty: 11, dir: 'up' },
    { x: 15, y: 13, to: 'jubilife_school', tx: 8, ty: 11, dir: 'up' },
    { x: 5, y: 19, to: 'jubilife_house', tx: 5, ty: 6, dir: 'up' },
    { x: 23, y: 19, to: 'jubilife_house2', tx: 5, ty: 6, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 8, text: 'POKéMON CENTER' },
    { x: 20, y: 4, w: 8, text: 'POKéMON MART' },
    { x: 8, y: 12, w: 12, text: "TRAINERS' SCHOOL", tone: '#f8e070' },
  ],
  signs: [
    { x: 3, y: 9, text: 'JUBILIFE CITY\n"The most modern city there is."\nTRAINERS’ SCHOOL — centre.\nROUTE 203 — south, to Oreburgh.' },
    { x: 3, y: 22, text: 'TRAINERS’ SCHOOL\nFree lessons, every day.\nIf a battle has ever confused you,\ngo in.' },
    { x: 28, y: 22, text: 'ROUTE 203 — SOUTH\nOreburgh City is beyond it.\nThe Gym there is the first one most\ntrainers take.' },
  ],
  npcs: [
    {
      id: 'jl_greeter', x: 13, y: 8, look: 'clerk', name: 'Greeter',
      movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['A badge already! Jubilife likes a winner.',
            'Seven to go, and the League will not come to you.'],
        },
        {
          lines: ['Welcome to Jubilife City! Biggest place you will have seen so far.',
            'The grey building in the middle is the TRAINERS’ SCHOOL. Go in.',
            'They will explain type matchups better than I can, and it is free.',
            'When you are done: ROUTE 203, south. Oreburgh and its Gym are past it.'],
        },
      ],
    },
    {
      id: 'jl_kid', x: 20, y: 16, look: 'kid', name: 'Nel', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['There are TWO of you walking round together.',
            'My brother says link trainers are showing off.\fI think it looks brilliant.'],
        },
        {
          lines: ['I go to the school every day and I still have not beaten the quiz.',
            'It is the one about which type beats which. It is HARD.'],
        },
      ],
    },
    {
      id: 'jl_suit', x: 25, y: 10, look: 'scientist', name: 'Analyst',
      movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { joined: true },
          lines: ['Rating {rating}, is it? The Hall board updates in real time now.',
            'Half this city checks it at lunch. The other half pretends not to.'],
        },
        {
          lines: ['Oreburgh has the Battle Hall, but Jubilife has the money that pays for it.',
            'Somebody has to. Announcers are not free.'],
        },
      ],
    },
  ],
  healPoint: { map: 'jubilife_center', x: 6, y: 5 },
});
