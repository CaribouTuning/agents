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
            '{buddy} was called down as well, so do not dawdle. Go on. I already packed your bag.'],
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

export const INTERIORS = [
  PLAYER_HOUSE, RIVAL_HOUSE, ROWAN_LAB, OREBURGH_CENTER, OREBURGH_MART,
  OREBURGH_GYM, OREBURGH_HOUSE, OREBURGH_HOUSE2, OREBURGH_HALL,
];
