import { defineMap } from './define.js';

export const TWINLEAF = defineMap('twinleaf', {
  name: 'Twinleaf Town', kind: 'town', music: 'town',
  tiles: [
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTT',
    'T..........,..::..,..........T',
    'T..GGGGGGG....::.............T',
    'T..GGGGGGG....::..,..........T',
    'T..#W#D#W#....::.............T',
    'T..:::::::::::::.............T',
    'T....*........::....TTT......T',
    'T....*........::...TTTTT.....T',
    'T.............::....TTT......T',
    'T..AAAAA......::....BBBBB....T',
    'T..AAAAA......::....BBBBB....T',
    'T..#WDW#......::....#WDW#....T',
    'T....:........::......:......T',
    'T....:::::::::::::::::.......T',
    'T.............::.............T',
    'T..S..........::..........S..T',
    'T.,...........::...........,.T',
    'T.............::.............T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 14, y: 0, to: 'route201', tx: 12, ty: 26, dir: 'up', edge: true },
    { x: 15, y: 0, to: 'route201', tx: 13, ty: 26, dir: 'up', edge: true },
    { x: 5, y: 12, to: 'player_house', tx: 5, ty: 6, dir: 'up' },
    { x: 22, y: 12, to: 'rival_house', tx: 5, ty: 6, dir: 'up' },
    { x: 6, y: 5, to: 'rowan_lab', tx: 6, ty: 7, dir: 'up' },
  ],
  signs: [
    { x: 3, y: 16, text: 'TWINLEAF TOWN\nWhere every road out is uphill.' },
    { x: 26, y: 16, text: 'Route 201 ahead.\nTall grass — carry a Pokémon with you.' },
  ],
  npcs: [
    {
      // Tam is the town's circuit superfan. Whoever is actually top of the
      // world ranking is who he has posters of — including, eventually, you.
      id: 'bv_kid', x: 10, y: 8, look: 'kid', name: 'Tam', movement: 'wander', facing: 'down',
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
      id: 'bv_oldman', x: 20, y: 15, look: 'oldMan', name: 'Hollis', movement: 'lookAround', facing: 'left',
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
      id: 'bv_woman', x: 24, y: 8, look: 'mom', name: 'Bev', movement: 'still', facing: 'down',
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
      id: 'bv_postman', x: 8, y: 17, look: 'worker', name: 'Postman', movement: 'lookAround', facing: 'down',
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
  healPoint: { map: 'twinleaf', x: 5, y: 13 },
});

export const OREBURGH = defineMap('oreburgh', {
  name: 'Oreburgh City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTTTT',
    'T.............::...............T',
    'T....,........::.........,.....T',
    'T..AAAAAA.....::......BBBBBB...T',
    'T..AAAAAA.....::......BBBBBB...T',
    'T..#W#D#W.....::......#W#D#W...T',
    'T.....:.......::.........:.....T',
    'T.....::::::::::::::::::::.....T',
    'T.............::..EEEEEEE......T',
    'T....*........::..EEEEEEE......T',
    'T.............::..#WWDDW#......T',
    'T..GGGGG......::...S....GGGGG..T',
    'T..GGGGG......::........GGGGG..T',
    'T..#WDW#......::........#WDW#..T',
    'T....:.....EEEEEEEE.......:....T',
    'T....:.....EEEEEEEE.......:....T',
    'T....:.....EEEEEEEE.......:....T',
    'T....:.....#W#DD#W#.......:....T',
    'T....:........::..........:....T',
    'T....::::::::::::::::::::::....T',
    'T.............::...............T',
    'T..S..........::..........S....T',
    'TTTTTTTTTTTTTT::TTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 14, y: 0, to: 'route207', tx: 12, ty: 16, dir: 'up', edge: true },
    { x: 15, y: 0, to: 'route207', tx: 13, ty: 16, dir: 'up', edge: true },
    { x: 14, y: 23, to: 'route202', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 15, y: 23, to: 'route202', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 6, y: 6, to: 'oreburgh_center', tx: 6, ty: 6, dir: 'up' },
    { x: 25, y: 6, to: 'oreburgh_mart', tx: 5, ty: 5, dir: 'up' },
    { x: 5, y: 14, to: 'oreburgh_house', tx: 5, ty: 6, dir: 'up' },
    { x: 26, y: 14, to: 'oreburgh_house2', tx: 5, ty: 6, dir: 'up' },
    { x: 14, y: 18, to: 'oreburgh_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 15, y: 18, to: 'oreburgh_gym', tx: 8, ty: 14, dir: 'up' },
    { x: 21, y: 11, to: 'oreburgh_hall', tx: 7, ty: 8, dir: 'up' },
    { x: 22, y: 11, to: 'oreburgh_hall', tx: 8, ty: 8, dir: 'up' },
  ],
  events: [
    // The survey Ines keeps talking about, left on the bench beside her.
    { x: 20, y: 21, flag: 'doc_survey_read', script: 'docSurvey' },
  ],
  signs: [
    { x: 3, y: 22, text: 'OREBURGH CITY\nCut from the hillside, stone by stone.' },
    { x: 26, y: 22, text: 'OREBURGH GYM\nLeader: ROARK\n"The quarry does not blink."' },
    { x: 19, y: 12, text: 'OREBURGH BATTLE HALL\nSanctioned venue of the World Circuit.\nOpen entry. Bring a team.' },
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
