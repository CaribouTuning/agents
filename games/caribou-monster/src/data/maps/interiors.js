import { defineMap } from './define.js';

const PLAYER_HOUSE = defineMap('player_house', {
  name: 'Home', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|k_v____bb_|',
    '|__________|',
    '|_e________|',
    '|__________|',
    '|_____p____|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'twinleaf', tx: 5, ty: 14, dir: 'down' }],
  npcs: [
    {
      id: 'ph_mom', x: 3, y: 4, look: 'mom', name: 'Mum', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { champion: true },
          lines: ['My child. Number one in the world.',
            'I have had four people knock on that door this week asking if you were in.',
            'I told them you were out. You are always out. That is rather the point.'],
        },
        {
          when: { titles: 1 },
          lines: ['They read your name out on the results sheet. Out loud. In the shop.',
            'The {lastTitle}. I had to go and sit down.',
            'Eat something before you go back out. Champions still have to eat.'],
        },
        {
          when: { linked: true },
          lines: ['Is {partner} with you? Out there, I mean. Right now.',
            'Good. I worry considerably less when there are two of you.',
            'Tell them they are welcome here any time. Tell them I said that.'],
        },
        {
          when: { joined: true },
          lines: ['Tam came round to tell me you had joined the circuit before you did.',
            'I do not mind. He was very excited and you are very busy.',
            'Come home when your team is tired. That has not stopped being true.'],
        },
        {
          when: { badges: 1 },
          lines: ['A badge. An actual badge.',
            'Your room is exactly as you left it, which is to say a disgrace.',
            'If your team gets tired, come home any time — or use a Pokémon Center.'],
        },
        {
          // Alone, but the other one is still a real person in this world.
          when: { all: [{ alone: true }, { flag: 'gotStarter' }] },
          pool: [
            ['{buddy} rang the house phone looking for you. I said you were out.',
              'They said "of course they are" in a tone I did not care for.',
              'Link up with them when you can. Two of you is better than one of you.'],
            ['No {buddy} today?',
              'You two used to be impossible to separate. Now I get one at a time.',
              'Go on. I will keep the light on.'],
            ['Look at you, a real trainer.',
              'Look after {lead} and it will look after you. That is the whole arrangement.',
              'If your team gets tired, come home any time — or use a Pokémon Center.'],
          ],
        },
        {
          lines: ['Professor Rowan came by looking for you. Something about a Pokémon she wants you to have.',
            '{buddy} was called down as well, so do not dawdle.\fGo on. I already packed your bag.',
            'And that Houndour was on our step again this morning.',
            'I said no. Then I gave her the end of the bacon.\fThat is how these arrangements start.'],
        },
      ],
      heals: true,
    },
  ],
  healPoint: { map: 'player_house', x: 5, y: 6 },
});

const RIVAL_HOUSE = defineMap('rival_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk_____bb_|',
    '|__________|',
    '|______e___|',
    '|__________|',
    '|_p________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'twinleaf', tx: 22, ty: 14, dir: 'down' }],
  npcs: [
    {
      id: 'rh_parent', x: 7, y: 4, look: 'oldMan', name: 'Neighbour', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'beatRival2' },
          lines: ['Came back through here last week, dropped the bag, went straight out again.',
            'Said you had beaten them twice now. Said it like it was your fault.',
            'Try not to let them win every argument. It only encourages it.'],
        },
        {
          when: { flag: 'beatRival1' },
          lines: ['Heard you two had it out on Route 201. Heard who won, as well.',
            'Do not expect that to be the end of it. It never is.'],
        },
        {
          when: { flag: 'hasBandit' },
          lines: ['So she went with you. Of course she did.',
            'That dog has slept on four doorsteps in this street and chosen exactly one person.',
            'Do not let her near anybody\u2019s washing line. I am asking as a favour.'],
        },
        {
          when: { linked: true },
          lines: ['Both of you out there at once. That is the whole street empty, then.',
            '{partner} came past earlier with the same look on their face you have got now.',
            'Whatever the two of you are up to, do it somewhere with a Center nearby.'],
        },
        {
          lines: ['Ran out of here at dawn shouting about the lab. You know how it is.',
            'Try not to let them win every argument. It only encourages it.'],
        },
      ],
    },
  ],
});

const ROWAN_LAB = defineMap('rowan_lab', {
  name: "Professor Rowan's Lab", kind: 'indoor', music: 'lab', darkEdges: false,
  tiles: [
    '||||||||||||||',
    '|kkk______kkk|',
    '|____________|',
    '|_e__e____e__|',
    '|____________|',
    '|__P______P__|',
    '|____________|',
    '|__p_________|',
    '||||||D|||||||',
  ],
  warps: [{ x: 6, y: 8, to: 'twinleaf', tx: 6, ty: 7, dir: 'down' }],
  npcs: [
    {
      id: 'lab_aspen', x: 6, y: 2, look: 'professor', name: 'Prof. Rowan', movement: 'still', facing: 'down',
      script: 'starter',
      dialogue: ['There you are. I have three Pokémon on that table and no one to raise them.',
        'Pick whichever one looks back at you. That is the only method that has ever worked.'],
    },
    {
      id: 'lab_aide', x: 10, y: 6, look: 'scientist', name: 'Aide', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { caught: 20 },
          lines: ['{caught} caught, {seen} seen. I have shown the professor. She made a noise.',
            'That noise means she is impressed and would rather not say so.'],
        },
        {
          when: { caught: 5 },
          lines: ['{caught} caught and {seen} seen so far. The Pokédex logs all of it automatically.',
            'The professor pretends it is for science. It is mostly for bragging.'],
        },
        {
          lines: ['The Pokédex records every species you see and every one you catch.',
            'The professor pretends it is for science. It is mostly for bragging.'],
        },
      ],
    },
  ],
});

const OREBURGH_CENTER = defineMap('oreburgh_center', {
  name: 'Pokémon Center', kind: 'indoor', music: 'center', darkEdges: false,
  tiles: [
    '||||||||||||||',
    '|__H_______P_|',
    '|_xxxxx______|',
    '|____________|',
    '|_p________p_|',
    '|____________|',
    '|____________|',
    '||||||DD||||||',
  ],
  warps: [
    { x: 6, y: 7, to: 'oreburgh', tx: 7, ty: 7, dir: 'down' },
    { x: 7, y: 7, to: 'oreburgh', tx: 7, ty: 7, dir: 'down' },
  ],
  npcs: [
    {
      id: 'ac_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        {
          when: { linked: true },
          lines: ['Welcome back. {partner} is showing as connected on the link network too.',
            'Shall I heal your team to full health?'],
        },
        {
          lines: ['Welcome to the Oreburgh Pokémon Center. Shall I heal your team to full health?'],
        },
      ],
    },
    {
      id: 'ac_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [
        {
          when: { caught: 12 },
          lines: ['{caught} caught. You will be needing the boxes before long.',
            'Walk up to the terminal and press A. Everything a full party cannot hold goes in there.'],
        },
        {
          lines: ['The storage system behind me holds anything your party cannot.',
            'Walk up to the terminal and press A.'],
        },
      ],
    },
    {
      // Someone who has just come off the Hall floor. What he says is read off
      // the live standings, so he is always complaining about a real result.
      id: 'ac_trainer', x: 9, y: 4, look: 'youngster', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { champion: true },
          pool: [
            ['I lost to somebody who lost to somebody who lost to you.',
              'That is as close as I am getting, and honestly it is close enough.'],
            ['You know they read the world number one out before every event?',
              'It has been the same name for years. Now it is yours. Very odd week for all of us.'],
          ],
        },
        {
          when: { joined: true },
          pool: [
            ['Knocked out in the first round. Again.',
              'Everyone says the same thing: "you get one match against {champion}, spend it well."',
              'I spent mine in about four turns.'],
            ['You are rated {rating}. I am rated less than that and I do not want to discuss it.',
              'Healing here is free. I still feel guilty about it every single time.'],
          ],
        },
        {
          lines: ['Healing here is free. I still feel guilty about it every single time.',
            'There is a Battle Hall east of here. Proper events. I get flattened at them regularly.'],
        },
      ],
    },
  ],
  pc: { x: 11, y: 1 },
  healPoint: { map: 'oreburgh_center', x: 6, y: 5 },
});

const OREBURGH_MART = defineMap('oreburgh_mart', {
  name: 'Poké Mart', kind: 'indoor', music: 'mart', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|MMMM______|',
    '|__________|',
    '|_xxx______|',
    '|__________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 6, to: 'oreburgh', tx: 25, ty: 7, dir: 'down' }],
  npcs: [
    {
      id: 'am_clerk', x: 3, y: 2, look: 'clerk', name: 'Clerk', movement: 'still', facing: 'down',
      script: 'shop', overCounter: true,
      dialogue: ['Welcome! What can I get you?'],
    },
    {
      id: 'am_shopper', x: 8, y: 4, look: 'lass', name: 'Shopper', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { joined: true },
          lines: ['They say circuit trainers never buy balls. All that prize money and no wild Pokémon.',
            'Buy more balls than you think you need anyway. You always need more balls.'],
        },
        {
          lines: ['Buy more balls than you think you need. You always need more balls.'],
        },
      ],
    },
  ],
  shop: true,
});

const OREBURGH_GYM = defineMap('oreburgh_gym', {
  name: 'Oreburgh Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|gggggg!!gggggg|',
    '|!!!!gg!!gg!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!!!!!gg!!!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!!!gg!!gg!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'oreburgh', tx: 14, ty: 20, dir: 'down' },
    { x: 8, y: 15, to: 'oreburgh', tx: 15, ty: 20, dir: 'down' },
  ],
  npcs: [
    {
      // The guide by the door. Every Pokemon game has one, and it is the
      // reason a first-timer knows what a Gym is for.
      id: 'gym1_guide', x: 5, y: 14, look: 'youngster', name: 'Gym Guide',
      facing: 'right', movement: 'still',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['You took the Coal Badge off Roark! I saw it!',
            'That badge makes traded Pokémon up to level 20 obey you.',
            'Seven more Gyms after this one. Then the League.'],
        },
        {
          lines: ['Hey! You here to challenge the Gym? Let me give you the rundown.',
            'This is a Pokémon Gym. Beat the Leader and he hands you a BADGE.',
            'Eight badges gets you into the Pokémon League. That is the whole road.',
            'Roark uses ROCK types. Rock is heavy, slow, and hates Water and Grass.',
            'Every trainer in here is between you and him. Go on — flatten them!'],
        },
      ],
    },
    { id: 'gym1_a', x: 2, y: 12, look: 'hiker', trainer: 'gym1_hiker1', facing: 'right', sight: 4, movement: 'still' },
    { id: 'gym1_b', x: 13, y: 8, look: 'worker', trainer: 'gym1_worker', facing: 'left', sight: 4, movement: 'still' },
    { id: 'gym1_c', x: 5, y: 4, look: 'hiker', trainer: 'gym1_hiker2', facing: 'down', sight: 3, movement: 'still' },
    {
      id: 'gym1_leader', x: 7, y: 1, look: 'leaderRock', trainer: 'gym1_leader',
      facing: 'down', sight: 0, movement: 'still',
      dialogue: [
        {
          lines: ['I am Roark. Gym Leader here, and foreman down the quarry.',
            'You want the COAL BADGE, you take it off me. That is how this works.',
            'Rock does not blink. Show me you can make it.'],
        },
      ],
      after: [
        {
          when: { champion: true },
          lines: ['World number one. Out of a gym I run in a quarry town.',
            'I tell every trainer who walks in here that rock does not blink.',
            'You did. Straight through the stone. Come back when you want a real rematch.'],
        },
        {
          when: { titles: 1 },
          lines: ['I saw the {lastTitle} result on the Hall board.',
            'Half this city was in that building. The other half was outside listening.',
            'Route 207 runs north. The Coal Badge opens some doors up there.'],
        },
        {
          when: { joined: true },
          lines: ['Straight through the stone.',
            'They tell me you registered at the Battle Hall. Good. Gyms teach you to win.',
            'The circuit teaches you what losing costs. Both are worth knowing.'],
        },
        {
          lines: ['Straight through the stone.',
            'Route 207 runs north out of the city. Take the Coal Badge with you — some doors only open for it.'],
        },
      ],
    },
  ],
});

const OREBURGH_HOUSE = defineMap('oreburgh_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|k__v___bb_|',
    '|__________|',
    '|__e_______|',
    '|__________|',
    '|_______p__|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'oreburgh', tx: 5, ty: 15, dir: 'down' }],
  npcs: [
    {
      id: 'ah_man', x: 4, y: 4, look: 'oldMan', name: 'Resident', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { leadLevel: 30 },
          lines: ['A Pokémon can only hold four moves. Learning a fifth means forgetting one.',
            'Your {lead} is level {leadLevel}. It has forgotten more than most Pokémon ever learn.',
            'Choose carefully. I have regretted a forgotten move for thirty years.'],
        },
        {
          lines: ['A Pokémon can only hold four moves. Learning a fifth means forgetting one.',
            'Choose carefully. I have regretted a forgotten move for thirty years.'],
        },
      ],
    },
  ],
});

const OREBURGH_HOUSE2 = defineMap('oreburgh_house2', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk____v___|',
    '|__________|',
    '|_____e____|',
    '|__________|',
    '|_p________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'oreburgh', tx: 26, ty: 15, dir: 'down' }],
  npcs: [
    {
      id: 'ah2_girl', x: 6, y: 4, look: 'lass', name: 'Resident', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['You are linked up right now, are you not. With {partner}.',
            'I can always tell. People walk differently when somebody else is in the world.',
            'My cousin does it every weekend. They battle, they trade, they argue about\nwho carried.'],
        },
        {
          when: { joined: true },
          lines: ['Two trainers can link up out on the routes, you know. My cousin does it every weekend.',
            'They count for the world ranking now, the link matches. Properly sanctioned.',
            'My cousin is rated four hundred points below you and will not stop mentioning it.'],
        },
        {
          lines: ['Two trainers can link up out on the routes, you know. My cousin does it every weekend.',
            'They battle, they trade, they argue about who carried. Sounds lovely.'],
        },
      ],
    },
    {
      id: 'ah2_kid', x: 9, y: 5, look: 'kid', name: 'Kid', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { champion: true },
          lines: ['MUM. MUM. THE WORLD NUMBER ONE IS IN OUR HOUSE.',
            'A Pokémon that faints still comes back! Did you know that? Do you know that already?'],
        },
        {
          when: { badges: 1 },
          lines: ['You have got a badge! Can I see it? Can I hold it?',
            'A Pokémon that faints still comes back! Just take it to the Centre. Or use a Revive.'],
        },
        {
          lines: ['A Pokémon that faints still comes back! Just take it to the Centre. Or use a Revive.'],
        },
      ],
    },
  ],
});

// ---- Oreburgh Battle Hall -------------------------------------------------
// Home of the World Circuit. The registration desk is the entry point to the
// whole side story; everything else in here is atmosphere.

const OREBURGH_HALL = defineMap('oreburgh_hall', {
  name: 'Oreburgh Battle Hall', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|++++++++++++++|',
    '|+S++++++++++!+|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|+++xxxxxxxx+++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 9, to: 'oreburgh', tx: 21, ty: 12, dir: 'down' },
    { x: 8, y: 9, to: 'oreburgh', tx: 22, ty: 12, dir: 'down' },
  ],
  signs: [
    { x: 2, y: 2, text: 'WORLD CIRCUIT — HOUSE RULES\nSingle elimination. No substitutions\nbetween rounds. Medical staff on site.\fCURRENT WORLD NO. 1\n{champion}\fYOU\n{rank} · rating {rating} · {cp} CP' },
  ],
  npcs: [
    {
      id: 'bh_desk', x: 7, y: 4, look: 'nurse', name: 'Registrar', movement: 'still', facing: 'down',
      script: 'circuitDesk', overCounter: true,
      dialogue: ['Welcome to the Battle Hall. Circuit business?'],
    },
    {
      id: 'bh_analyst', x: 3, y: 7, look: 'scientist', name: 'Analyst', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { streak: 3 },
          lines: ['{streak} straight. I have your last four matches on the desk here.',
            'You are winning the openings now, not just the endings. That is the part people miss.'],
        },
        {
          when: { joined: true },
          pool: [
            ['Rating moves every match. Circuit Points only ever go up.',
              'That is deliberate. One measures how good you are right now. The other measures what you have done.'],
            ['You are rated {rating}. {champion} is the number the whole board is scaled against.',
              'Everybody below them is really just measuring the distance.'],
            ['{cp} Circuit Points, {titles} titles, career {rank}.',
              'I could tell you what that projects to. You would not like the error bars.'],
          ],
        },
        {
          lines: ['Rating moves every match. Circuit Points only ever go up.',
            'That is deliberate. One measures how good you are right now. The other measures what you have done.'],
        },
      ],
    },
    {
      // The Wire's reporter quotes the actual top story in the player's feed.
      id: 'bh_fan', x: 12, y: 7, look: 'lass', name: 'Reporter', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { champion: true },
          lines: ['I have been filing on this circuit for nine years.',
            'I have written the same name at the top of the standings for most of them. Not any more.',
            'Give me two minutes after your next match. The Wire will want the whole thing.'],
        },
        {
          when: { all: [{ titles: 1 }, { hype: 55 }] },
          lines: ['You give good copy. Do you know how rare that is?',
            'Half the people in this building answer every question with "we took it one match at a time".',
            'My editor has a folder with your name on it. It is not a small folder.'],
        },
        {
          when: { all: [{ titles: 1 }, { respect: 40 }] },
          lines: ['You never once blamed a Pokémon in a press conference. I checked.',
            'The trainers in that locker room noticed before I did.',
            'It does not sell papers. It does something better than that.'],
        },
        {
          when: { titles: 1 },
          pool: [
            ['My last piece on you led with: "{headline}".',
              'That was mine. The subeditor wanted something duller.'],
            ['I file for the Sinnoh Battle Wire. Everything in this building goes out on the feed.',
              '{titles} title so far. I would like to be the one who writes about the next.'],
          ],
        },
        {
          when: { all: [{ linked: true }, { joined: true }] },
          lines: ['You are linked with {partner}. I saw it on the board.',
            'Sanctioned link matches count for the ranking.',
            'Which means I have to write them up like anything else.',
            'Two names from the same town on the same feed.',
            'That is a story, and you know it.'],
        },
        {
          when: { joined: true },
          lines: ['I file for the Sinnoh Battle Wire. Every result in this building goes out on the feed.',
            'You are on the register now, so: win enough and you will read about yourself.',
            'Lose enough and you will read about that too.'],
        },
        {
          lines: ['I file for the Sinnoh Battle Wire. Every result in this building goes out on the feed.',
            'Win enough and you will read about yourself. Lose enough and you will read about that too.'],
        },
      ],
    },
    {
      id: 'bh_vet', x: 12, y: 3, look: 'oldMan', name: 'Old Hand', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { titles: 6 },
          lines: ['Six steps. Rookie Cup to the World Finals.',
            'Nobody had ever taken them all. I used to say that to every rookie who came through that door.',
            'I will have to find something else to say now, will I not.'],
        },
        {
          when: { titles: 3 },
          lines: ['Three titles. Do you know how many trainers get three?',
            'I stopped at one. Sinnoh Open, a very long time ago. I still have the sheet.',
            'Keep going. Somebody in this building ought to finish the job.'],
        },
        {
          when: { titles: 1 },
          lines: ['You took the {lastTitle}. I was here. Stood right on this spot.',
            'Rookie Cup, Sinnoh Open, Invitational, Nationals, Continental, then the World Finals.',
            'Six steps. Nobody has ever taken them in one season. Nobody yet.'],
        },
        {
          lines: ['Rookie Cup, Sinnoh Open, Invitational, Nationals, Continental, then the World Finals.',
            'Six steps. Nobody has ever taken them in one season.',
            '{champion} came closest. Won five in a row and lost the last one. Never talks about it.'],
        },
      ],
    },
    {
      // Somebody has to be the one who does not care about any of it.
      id: 'bh_cleaner', x: 3, y: 3, look: 'worker', name: 'Groundskeeper', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          when: { champion: true },
          lines: ['Mind the floor, world number one. It is still wet.',
            'Twenty-two years I have swept this hall. You are the eleventh person to hold that rank.',
            'All eleven of them walked on wet floors.'],
        },
        {
          when: { all: [{ joined: true }, { hype: 65 }] },
          lines: ['You are the loud one. I hear you from the corridor.',
            'Nothing wrong with loud. The hall fills up when the loud ones are on.',
            'Just remember which of us is still here when it empties.'],
        },
        {
          when: { all: [{ joined: true }, { respect: 45 }] },
          lines: ['The other trainers speak well of you. That is not nothing.',
            'I hear what they say in here when the cameras are outside. Usually it is worse.'],
        },
        {
          when: { joined: true },
          pool: [
            ['They all come in here talking about ratings and points.',
              'Then they lose, and they go and sit in the corridor, and they are just people again.'],
            ['Best match I ever saw in here was two nobodies in a Rookie Cup.',
              'Went a hundred and forty turns. Nobody remembers it but me.'],
          ],
        },
        {
          lines: ['Mind the floor. Big event tomorrow and this lot will not sweep itself.'],
        },
      ],
    },
  ],
});

// (the INTERIORS list is at the bottom of this file, after the factories)

// ---------------------------------------------------------------------------
// Every town needs a Center and a Mart, and they are the same building in
// every town — the layout is the point. These build one from the four facts
// that actually differ: which town it is in, and where its door lets out.
// ---------------------------------------------------------------------------

export function makeCenter(id, { town, backX, backY, name = 'Pokémon Center', greeting, extras = [] }) {
  return defineMap(id, {
    name, kind: 'indoor', music: 'center', darkEdges: false,
    tiles: [
      '||||||||||||||',
      '|__H_______P_|',
      '|_xxxxx______|',
      '|____________|',
      '|_p________p_|',
      '|____________|',
      '|____________|',
      '||||||DD||||||',
    ],
    warps: [
      { x: 6, y: 7, to: town, tx: backX, ty: backY, dir: 'down' },
      { x: 7, y: 7, to: town, tx: backX, ty: backY, dir: 'down' },
    ],
    npcs: [
      {
        id: `${id}_nurse`, x: 4, y: 1, look: 'nurse', name: 'Nurse',
        movement: 'still', facing: 'down', script: 'heal', overCounter: true,
        dialogue: [
          {
            when: { linked: true },
            lines: ['Welcome back. {partner} is showing as connected on the link network too.',
              'Shall I heal your team to full health?'],
          },
          { lines: [greeting || 'Welcome to the Pokémon Center. Shall I heal your team to full health?'] },
        ],
      },
      {
        id: `${id}_pc`, x: 10, y: 1, look: 'clerk', name: 'Attendant',
        movement: 'still', facing: 'down', overCounter: true,
        dialogue: [
          {
            when: { caught: 12 },
            lines: ['{caught} caught. You will be needing the boxes before long.',
              'Walk up to the terminal and press A.'],
          },
          {
            lines: ['The storage system behind me holds anything your party cannot.',
              'Walk up to the terminal and press A.'],
          },
        ],
      },
      ...extras,
    ],
    healPoint: { map: id, x: 6, y: 5 },
  });
}

export function makeMart(id, { town, backX, backY, extras = [] }) {
  return defineMap(id, {
    name: 'Poké Mart', kind: 'indoor', music: 'mart', darkEdges: false,
    tiles: [
      '||||||||||||',
      '|MMMM______|',
      '|__________|',
      '|_xxx______|',
      '|__________|',
      '|__________|',
      '|||||D||||||',
    ],
    warps: [{ x: 5, y: 6, to: town, tx: backX, ty: backY, dir: 'down' }],
    npcs: [
      {
        id: `${id}_clerk`, x: 3, y: 2, look: 'clerk', name: 'Clerk',
        movement: 'still', facing: 'down', script: 'shop', overCounter: true,
        dialogue: ['Welcome! What can I get you?'],
      },
      ...extras,
    ],
  });
}

// ---------------------------------------------------------------------------
// The Trainers' School.
//
// Every Pokemon game has one and every one of them exists for the same
// reason: a battle system with eighteen types, five status conditions and a
// stat-stage table cannot be taught by a tooltip. It is taught by four people
// in a room who each explain one thing properly, and by a blackboard you can
// walk up to and read.
// ---------------------------------------------------------------------------

const JUBILIFE_SCHOOL = defineMap('jubilife_school', {
  name: "Trainers' School", kind: 'indoor', music: 'lab', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|kkkkkkkkkkkkkk|',
    '|++++++++++++++|',
    '|+ee+ee++ee+ee+|',
    '|++++++++++++++|',
    '|+ee+ee++ee+ee+|',
    '|++++++++++++++|',
    '|+ee+ee++ee+ee+|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 12, to: 'jubilife', tx: 14, ty: 14, dir: 'down' },
    { x: 8, y: 12, to: 'jubilife', tx: 15, ty: 14, dir: 'down' },
  ],
  signs: [
    { x: 3, y: 1, text: 'BLACKBOARD — TYPES\nWater beats Fire, Rock and Ground.\nGrass beats Water, Rock and Ground.\nFire beats Grass, Bug, Ice and Steel.\nEach of those three loses to the next.' },
    { x: 6, y: 1, text: 'BLACKBOARD — TYPES II\nElectric beats Water and Flying,\nand does NOTHING to Ground.\nPsychic beats Fighting and Poison.\nDark and Ghost beat Psychic.' },
    { x: 9, y: 1, text: 'BLACKBOARD — STATUS\nPAR halves Speed and skips turns.\nBRN halves Attack and burns each turn.\nSLP costs the foe whole turns —\nthe best moment to throw a ball.' },
    { x: 12, y: 1, text: 'BLACKBOARD — STATS\nGROWL and LEER lower the foe.\nDEFENSE CURL and HARDEN raise you.\nSix stages up or down is the limit.\nSwitching out clears every stage.' },
  ],
  npcs: [
    {
      id: 'sch_teacher', x: 7, y: 2, look: 'professor', name: 'Ms. Orme',
      movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['A Coal Badge. Then you have already met a Rock-type Gym.',
            'You will have noticed Water and Grass go straight through them.',
            'That is the whole lesson, really. Everything else is practice.'],
        },
        {
          lines: ['Welcome. Sit anywhere, read the boards, ask the class.',
            'Here is the short version: every Pokémon has one or two TYPES,\fand every move has one.',
            'A move that is strong against the foe’s type does DOUBLE damage.\fWeak against it does half.',
            'The game tells you: "It’s super effective!" or "not very effective".\fListen to it.',
            'And a move of your own type hits harder than one that is not.\fUse a Grass move on a Grass Pokémon.',
            'That is it. That is the game. Go and be good at it.'],
        },
      ],
    },
    {
      id: 'sch_pupil1', x: 4, y: 5, look: 'lass', name: 'Pupil', movement: 'still', facing: 'right',
      dialogue: [
        {
          lines: ['I keep losing because I forget I can SWITCH.',
            'If the foe is beating your lead, swap to something that resists it.',
            'Switching costs a turn. Fainting costs the whole Pokémon.'],
        },
      ],
    },
    {
      id: 'sch_pupil2', x: 8, y: 5, look: 'youngster', name: 'Pupil', movement: 'still', facing: 'left',
      dialogue: [
        {
          lines: ['Everyone forgets POTIONS exist until they are out of Pokémon.',
            'BAG in the middle of a battle. It costs a turn and it is nearly always worth it.',
            'Same with balls. BAG, then BALLS, then pick one.'],
        },
      ],
    },
    {
      id: 'sch_pupil3', x: 4, y: 9, look: 'bugCatcher', name: 'Pupil', movement: 'still', facing: 'right',
      dialogue: [
        {
          when: { linked: true },
          lines: ['You are LINKED? With another actual person?',
            'Ms. Orme says a link battle is the only honest test there is.',
            'The other one is thinking back at you.'],
        },
        {
          lines: ['A Pokémon that likes you fights harder. Really.',
            'Walk about with it, win with it, level it up. It notices.'],
        },
      ],
    },
    {
      id: 'sch_prize', x: 10, y: 9, look: 'worker', name: 'Caretaker', movement: 'still', facing: 'left',
      script: 'schoolGift',
      dialogue: [{ lines: ['Stayed for the whole lesson, did you? Here — the school keeps a few of these.'] }],
    },
  ],
});


// ---------------------------------------------------------------------------
// Sandgem and Jubilife, built from the shared shells above.
// ---------------------------------------------------------------------------

const SANDGEM_CENTER = makeCenter('sandgem_center', {
  town: 'sandgem', backX: 7, backY: 6,
  greeting: 'Welcome to the Sandgem Pokémon Center. Shall I heal your team?',
});
const SANDGEM_MART = makeMart('sandgem_mart', {
  town: 'sandgem', backX: 21, backY: 7,
  extras: [{
    id: 'sgm_shopper', x: 8, y: 4, look: 'youngster', name: 'Shopper',
    movement: 'still', facing: 'left',
    dialogue: [{
      lines: ['POTIONS first, BALLS second, and never leave with an empty bag.',
        'Whatever you think you need, buy one more.'],
    }],
  }],
});

const SANDGEM_HOUSE = defineMap('sandgem_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk____bb__|',
    '|__________|',
    '|_e________|',
    '|__________|',
    '|_p_______v|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'sandgem', tx: 11, ty: 12, dir: 'down' }],
  npcs: [
    {
      id: 'sgh_man', x: 3, y: 3, look: 'oldMan', name: 'Resident',
      movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'hasBandit' },
          lines: ['There is a Houndour sitting on my step every time you come in here.',
            'She is not begging. She is supervising.\fThere is a difference and she knows it.'],
        },
        {
          lines: ['Sandgem is quiet, and I intend to keep it that way.',
            'Jubilife is up the road if you want noise. They have got a school and everything.'],
        },
      ],
    },
  ],
});

const JUBILIFE_CENTER = makeCenter('jubilife_center', {
  town: 'jubilife', backX: 7, backY: 6,
  greeting: 'Welcome to the Jubilife Pokémon Center — the busiest one there is.',
  extras: [{
    id: 'jc_registrar', x: 9, y: 4, look: 'nurse', name: 'Registrar',
    movement: 'still', facing: 'down', script: 'pairRegistry',
    dialogue: [
      {
        when: { flag: 'pairRegistered' },
        lines: ['You are both on the register. Second page, near the top.'],
      },
      {
        when: { linked: true },
        lines: ['Two of you on one link! Come here, I will write you down.'],
      },
      { lines: ['This desk registers LINKED PAIRS. Bring the other one.'] },
    ],
  }, {
    id: 'jc_traveller', x: 3, y: 5, look: 'sailor', name: 'Traveller',
    movement: 'still', facing: 'down',
    dialogue: [
      {
        when: { linked: true },
        lines: ['Two trainers on one link, walking the same road.',
          'I have seen a lot of pairs come through here.',
          'The ones that finish are the ones that wait for each other.'],
      },
      {
        lines: ['Heal here before Route 203. There is nothing between here and Oreburgh but trainers.'],
      },
    ],
  }],
});
const JUBILIFE_MART = makeMart('jubilife_mart', {
  town: 'jubilife', backX: 24, backY: 6,
  extras: [{
    id: 'jm_shopper', x: 8, y: 4, look: 'lass', name: 'Shopper',
    movement: 'still', facing: 'left',
    dialogue: [{
      when: { maxBadges: 0 },
      lines: ['Going for the Oreburgh Gym? Rock types hit like a wall falling on you.',
        'Buy POTIONS. More than you want to. You will use them all.'],
    }, {
      lines: ['Stock changes as you win badges. Come back after the Gym.'],
    }],
  }],
});

const JUBILIFE_HOUSE = defineMap('jubilife_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk____bb__|',
    '|__________|',
    '|_e________|',
    '|__________|',
    '|_p_______v|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'jubilife', tx: 5, ty: 20, dir: 'down' }],
  npcs: [
    {
      id: 'jh_woman', x: 3, y: 3, look: 'mom', name: 'Resident',
      movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { champion: true },
          lines: ['You are the one off the Hall board. In MY front room.',
            'My son will not believe this and I am not going to stop telling him.'],
        },
        {
          lines: ['My son is at the school every single day and has never once beaten the quiz.',
            'Do not tell him I told you.'],
        },
      ],
    },
  ],
});

const JUBILIFE_HOUSE2 = defineMap('jubilife_house2', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk____bb__|',
    '|__________|',
    '|_e________|',
    '|__________|',
    '|_p_______v|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'jubilife', tx: 23, ty: 20, dir: 'down' }],
  npcs: [
    {
      id: 'jh2_man', x: 8, y: 3, look: 'grunt', name: 'Man in Blue',
      movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { flag: 'beatCommander' },
          lines: ['...You are the one from the Gate.',
            'I am not with them. I was never with them. I rent this room.',
            'Whatever you found under that hill — I hope you put it back.'],
        },
        {
          lines: ['Nice city. Very modern. Very well lit.',
            'You would think somewhere this bright would notice what goes on in it.'],
        },
      ],
    },
  ],
});


export const INTERIORS = [
  PLAYER_HOUSE, RIVAL_HOUSE, ROWAN_LAB,
  SANDGEM_CENTER, SANDGEM_MART, SANDGEM_HOUSE,
  JUBILIFE_CENTER, JUBILIFE_MART, JUBILIFE_SCHOOL, JUBILIFE_HOUSE, JUBILIFE_HOUSE2,
  OREBURGH_CENTER, OREBURGH_MART, OREBURGH_GYM, OREBURGH_HOUSE, OREBURGH_HOUSE2,
  OREBURGH_HALL,
];
