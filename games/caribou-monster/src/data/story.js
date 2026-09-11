// The story bible.
//
// Every line the main plot speaks lives here, so the scripts in
// game/overworld/scripts.js are sequencing and this is writing. Two things
// this file is trying very hard to be:
//
//  1. Specific. "Team Galactic is up to something" is not a story. A grunt
//     who is annoyed that the readings went up on his shift is a story.
//  2. Re-readable. The plot turns on one fact revealed late, and almost every
//     scene before it is written so that it means something slightly different
//     afterwards. Mars saying "we will not make that mistake twice" is a
//     threat on the way in and an admission on the way out.

// ---- Cass Wren -------------------------------------------------------------
// The rival. She grew up four doors down, started a year before you, and is
// already carrying a world ranking she is quietly proud of. She is not a brat
// and she is not secretly kind: she is a competitor who has decided you are
// worth keeping track of, which from her is a large compliment.
//
// She is the same Cass Wren who is rated 1180 on the World Circuit. One person,
// one relationship, from a dirt road in Twinleaf to the World Finals.

/**
 * Which Cass you grew up four doors down from.
 *
 * A boy when Matthew is holding the phone, a girl when Sammy is. The two of
 * them play this game side by side and each of them should have their own
 * rival to run into rather than sharing one — and "Cass" is the same name
 * either way, which is why it was chosen.
 */
export function cassLook(state) {
  const look = state && state.player && state.player.look;
  return look === 'sammy' ? 'rivalGirl' : 'rivalBoy';
}

export const CASS = {
  name: 'Cass Wren',
  // The default, for anything that asks before a game has been started. Every
  // live use goes through `cassLook(state)`.
  look: 'rivalGirl',

  // Route 201, minutes after you get your first Pokémon.
  first: {
    approach: [
      'Cass: There you are. I have been standing here for an hour.',
      'Cass: Rowan called my mum this morning to say you were finally coming in.',
      'Cass: Finally. His word, not mine.',
    ],
    pick: [
      'Cass: So you took the {starter}.',
      'Cass: I took the one that beats it. Obviously. I was here at seven.',
      'Cass: Do not make a face. You would have done the same if you got up.',
    ],
    pre: ['Cass: One year. That is how far ahead I am.\fLet us find out how much of a year is worth.'],
    win: [
      'Cass: Hm.',
      'Cass: That is not what a year is supposed to look like.',
      'Cass: I am going north. Oreburgh, the gym, the Hall. All of it.',
      'Cass: Keep up and I will keep taking you seriously.',
    ],
    lose: [
      'Cass: There it is. That is what a year looks like.',
      'Cass: Go and heal up. I am not going anywhere. That is sort of the problem.',
    ],
  },

  // Outside Oreburgh, once you have made it up the road.
  second: {
    approach: [
      'Cass: You made it. I did wonder.',
      'Cass: I have been in that grey building four times this week. The Battle Hall.',
      'Cass: Sanctioned circuit events. A real ranking with real numbers in it.',
      'Cass: I am 1180. That is not a good number. It is just a real one.',
    ],
    pre: ['Cass: Badge first, though. Roark does not care what anyone is rated.\fCome on. Same as always.'],
    win: [
      'Cass: You have got faster.',
      'Cass: Not better. Faster. There is a difference and I will explain it to you one day.',
      'Cass: The Gym is the stone one at the south end. You cannot miss it, it has a badge over the door.',
      'Cass: Roark is Rock. Bring something Grass or Water.\fI am telling you because you would find out the hard way otherwise.',
    ],
    lose: [
      'Cass: Good. I was worried this was going to get boring.',
      'Cass: Centre is the red roof. Do not go into the gym like that.',
    ],
  },

  // Route 207, at the mouth of Oreburgh Gate, with the coats already inside.
  third: {
    approach: [
      'Cass: Do not go in there.',
      'Cass: I am not being clever. I have been up here twice this week.',
      'Cass: There are more of them each time.',
      'Cass: They are not looking for Pokémon. They have got instruments.',
    ],
    pre: [
      'Cass: So obviously you are going in anyway.',
      'Cass: Fine. Then you are going in having beaten me, or you are not going in.',
    ],
    win: [
      'Cass: ...Right.',
      'Cass: I am not going to pretend I am not annoyed about that.',
      'Cass: Take this. My mum makes me carry three.',
      'Cass: And listen — if you are not out in a day I am coming in after you.',
      'Cass: I will be insufferable about it. You know I will.',
    ],
    lose: [
      'Cass: Good. Now go home.',
      'Cass: ...You are not going home, are you.',
      'Cass: At least go and heal first. Please.',
    ],
  },

  // Said when the other player is in the world too. Cass has opinions about
  // being outnumbered.
  linked: [
    'Cass: And you have got {partner} with you. Of course you have.',
    'Cass: Two of you. Against one of me. In what world is that the fair version.',
    'Cass: ...Go on then. Both of you. I will wait.',
  ],

  // After the Everlight. She is at the Battle Hall, and for once she is not
  // keeping score.
  after: [
    'Cass: The sky went out.',
    'Cass: Everyone in the Hall was outside on the steps looking up at nothing.',
    'Cass: And I knew. Straight away. I did not even have to ask.',
    'Cass: I am still going to beat you at this. The ranking is the ranking.',
    'Cass: But I am glad it was you up there. I would not have opened it.',
    'Cass: I would have tried to. That is the difference, is it not.',
  ],
};

// ---- Professor Rowan --------------------------------------------------------
// He is not a vending machine that dispenses a starter. He is a man who tried
// this thirty years ago, failed, and has spent the time since working out why —
// and who has just realised the answer means he has to send somebody else.

export const ROWAN = {
  give: [
    'Prof. Rowan: There you are.',
    'Prof. Rowan: I have three young Pokémon on that table and nobody to raise them.\fTake a look.',
  ],
  chosen: [
    'Prof. Rowan: Good choice. They all are.',
    'Prof. Rowan: Take this as well. You will want to know what you are looking at out there.',
  ],
  // The detail that pays off two acts later, dropped as an aside nobody
  // remembers on the first pass.
  dex: [
    'Prof. Rowan: It logs everything you see and everything you catch.',
    'Prof. Rowan: It also logs ambient light. Do not worry about that part.',
    'Prof. Rowan: An old habit of mine. The data has to go somewhere.',
  ],
  send: [
    'Prof. Rowan: North, then. Route 201 to Sandgem, Route 202 to Jubilife,\fRoute 203 to Oreburgh.',
    'Prof. Rowan: Stop at the Trainers’ School in Jubilife.\fIt is free and it is better than anything I could tell you here.',
    // She used to put Roark's Gym in Jubilife, which is two towns early and
    // exactly the kind of thing that makes a world stop being one. The badge
    // count is a slot now, filled from the Gyms this game actually has.
    'Prof. Rowan: Keep going to Oreburgh after that. The mining city.\fThere is a Pokémon Gym there. Roark runs it — Rock types.',
    'Prof. Rowan: Beat him and he gives you the Coal Badge.\f{leagueBadges} of those and the League has to let you in.',
    'Prof. Rowan: That is the road. Go and walk it.',
  ],

  // Over the Pokédex, the moment you pick up the Aurora Charm.
  call: [
    '*The Pokédex chirps twice. It has never done that before.*',
    'Prof. Rowan: Do not put it down. Whatever you have just picked up, do not put it down.',
    'Prof. Rowan: My readings went off the top of the scale about four seconds ago.',
    'Prof. Rowan: Describe it to me.',
  ],
  callTwist: [
    'Prof. Rowan: Warm. You are certain it is warm.',
    'Prof. Rowan: Then it has not been in that rock for centuries. It has been there for minutes.',
    'Prof. Rowan: That is not an artefact you found.',
    'Prof. Rowan: That is a key. Galactic made it.',
    'Prof. Rowan: The door under that hill does not open for anyone who wants in.',
    'Prof. Rowan: They know that. They have known it for years.',
    'Prof. Rowan: So they built a key they could not turn.',
    'Prof. Rowan: Then they left it where a trainer would find it, and waited.',
    'Prof. Rowan: The commander did not lose to you. She stepped aside.',
  ],
  // If the two of you are out there together, he says so.
  callLinked: [
    'Prof. Rowan: Is {partner} with you?',
    'Prof. Rowan: Good. Do not go in there on your own. I did that.',
  ],

  callConfession: [
    'Prof. Rowan: ...I should tell you the rest.',
    'Prof. Rowan: I stood in front of that seam thirty-one years ago.',
    'Prof. Rowan: Full team. Every instrument I owned.',
    'Prof. Rowan: It did not open. I have spent three decades working out what I got wrong.',
    'Prof. Rowan: I think what I got wrong was that I wanted in.',
    'Prof. Rowan: You were not going up there to open anything.',
    'Prof. Rowan: You were walking a road because an old man told you\nit was the whole point.',
    'Prof. Rowan: I am sorry.',
    'Prof. Rowan: That is either the kindest thing I have ever done,',
    'Prof. Rowan: or the worst. I genuinely do not know which.',
    'Prof. Rowan: Go carefully.',
    'Prof. Rowan: And keep the light meter running.',
  ],

  // Outside the Gate, afterwards.
  after: [
    'Prof. Rowan: I have been standing out here for six hours.',
    'Prof. Rowan: I could not go in. I want you to understand that I tried.',
    'Prof. Rowan: Thirty-one years of readings, and the answer is that the door\nwas never locked.',
    'Prof. Rowan: It was held. From the inside.',
    'Prof. Rowan: Somebody was standing behind it making sure it stayed shut.',
    'Prof. Rowan: And you knocked.',
  ],
  afterCaught: [
    'Prof. Rowan: ...And it came with you.',
    'Prof. Rowan: Of course it did.',
    'Prof. Rowan: It has been holding that door alone since before there was\na town to hold it against.',
    'Prof. Rowan: Look after it. That is not a professor talking.',
  ],
};

// ---- Commander Mars ---------------------------------------------------------
// Her first scene reads as a threat. Her last scene reveals the first one was
// a performance, and she is much better at this than you assumed.

export const MARS = {
  intro: [
    'A figure in a long coat is standing over a seam of pale light in the rock.',
    'Mars: The Everlight sleeps under this hill.',
    'Mars: Galactic intends to wake it.',
    'Mars: You are one trainer. Reconsider.',
  ],
  // Written to be re-read. On the way in this is a villain being beaten. On
  // the way out it is somebody checking a box.
  defeat: [
    'Mars: One trainer.',
    'Mars: Noted.',
    'Mars: We will not make that mistake twice.',
  ],
  withdraw: [
    'She does not look at her Pokémon. She looks at you, for slightly too long.',
    'Mars: Get out of the hill, child. The instruments are expensive.',
    'She walks out without collecting a single piece of equipment.',
  ],

  // She arrives at the chamber four hours late.
  late: [
    'Boots on stone, coming fast, and then stopping.',
    'Mars: ...',
    'Mars: Four hours.',
    'Mars: We ran that operation for fourteen months. Two commanders. Nine sites.',
    'Mars: We built the key. We picked the hill. We picked the trainer.',
    'Mars: We picked YOU.',
    'Mars: And you were four hours faster than the people who wrote the plan.',
  ],
  lateCaught: [
    'She looks at the ball in your hand for a long moment.',
    'Mars: Hm.',
    'Mars: Do you know what the worst part is?',
    'Mars: It would never have come out for us. Not in fourteen months.\nNot in fourteen years.',
    'Mars: Enjoy it. Genuinely. That is not sarcasm, and I am as surprised as you are.',
  ],
  lateLeft: [
    'Mars: It is still in there.',
    'Mars: You opened the door and you left it standing there.',
    'Mars: I do not know whether that makes you a fool,',
    'Mars: or the only careful person I have met all year.',
    'Mars: We will be back. Obviously we will be back.',
  ],
};

// ---- The chamber ------------------------------------------------------------

export const EVERLIGHT = {
  shut: [
    'A seam of pale light runs up the rock face.',
    'It is cold to the touch, and it does not move.',
  ],
  opening: [
    'The seam of light is directly ahead.',
    'The Aurora Charm in your bag has started to glow.',
    'It is not answering the light. The light is answering it.',
    'The rock draws back like a held breath.',
  ],
  firstSight: [
    'The chamber opens out, and the light has a shape standing in it.',
    'It has its back to the door.',
    'It has been standing with its back to that door, you understand suddenly,\nfor a very long time.',
    'It turns around. It does not seem surprised.',
    'It seems relieved.',
  ],
  again: ['It is still here. It has not moved at all.'],

  // Seeing it is not understanding it.
  //
  // The seam opens early — Mars leaves the charm behind in the first act, and
  // that is deliberate. But a player who walks in at that point is looking at
  // something they have no way to read yet, and letting them resolve it there
  // would put the end of the story two hours into it. So the first visit is a
  // sighting: the room, the shape, and the certainty that you are missing
  // something. What you are missing is in Canalave, in a book, three acts
  // later.
  tooEarly: [
    'It looks at you for a long moment.',
    'Then past you, at the seam. Then down at the floor.',
    'At three points on it, spaced wide apart, marked by nothing at all.',
    'It is waiting for you to understand something.',
    'You do not understand it.',
    '*You could stand here all day. It is not going to explain.*',
  ],
  understood: [
    'You know what the three points on the floor are now.',
    'Not keys. Not locks. Nothing here is a door.',
    'They are the places the weight sits. Two of them are empty.',
    'It has been holding the difference by itself for thirty-one years.',
    'It watches you work it out, and something in the way it is standing\nchanges.',
  ],
  quiet: [
    'The chamber is quiet now.',
    'The light in the rock is ordinary light, and the room is just a room.',
  ],
  caught: [
    'The light goes out of the rock. All at once. Everywhere.',
    'Somewhere above you, a whole region stops seeing an aurora\nit could not explain.',
  ],
  declined: [
    'It folds back into the light, unhurried.',
    'It will be here when you are ready. It has been very patient so far.',
  ],
  fled: ['You back out of the chamber. It does not follow. It watches you go.'],
};

// ---- Documents --------------------------------------------------------------
// Things lying around the world that nobody makes you read. Each one is a piece
// of the twist, placed so that it is available *before* the reveal — the story
// should be solvable, not just survivable.

export const DOCUMENTS = {
  survey: {
    title: 'QUARRY SURVEY — 90 YEARS OLD',
    pages: [
      'Seam at the north face reads warm at all hours and in all weathers.\fNo geological explanation offered. None sought.',
      'Handwritten in the margin, in a different pen:\f"The Everlight does not sleep. It waits, and it is patient,\nand it is not alone."',
      'The report is signed and countersigned.',
      'Nobody appears to have asked the marginal note any questions at all.',
    ],
  },
  memo: {
    title: 'GALACTIC FIELD MEMO — SITE 9',
    pages: [
      'SITE 9 (OREBURGH GATE). Readings up 40% on the month.\fThis is expected. This is the whole point. Stop reporting it as an anomaly.',
      'Reminder to all field staff: the artefact is NOT to be carried\ninto the chamber approach.',
      'Not once. Not to test it.',
      'If you are asked why, the answer is above your grade.\fIf you work it out on your own, keep it to yourself.',
      '— M.',
    ],
  },
  logbook: {
    title: 'A WORN FIELD LOGBOOK',
    pages: [
      'The first forty pages are light readings in a young hand.\fThe dates run from thirty-one years ago.',
      'Day 209. Full team. Every instrument. Stood there six hours.\fNothing. It does not even acknowledge me.',
      'Day 210. Went back at dawn in case it was the hour. It was not the hour.',
      'Day 344. I have been asking the wrong question.\fI keep asking what opens it.\fI should be asking what it is holding shut, and who is holding it.',
      'The remaining pages are blank. The book has been kept anyway.',
    ],
  },
};


/**
 * Bandit.
 *
 * Sammy's dog, which in this world means a Houndour — the Dark-type one with
 * the bone-white markings and a face like a mask, which is where the name
 * came from and also, as far as he is concerned, the job description.
 *
 * He is not a gift from a professor and he was never caught. He turned up at
 * the back door one winter, stole a whole string of sausages, and then
 * declined to leave. The family gave up and set a bowl down. He has been on
 * the doorstep every morning since.
 *
 * When Sammy leaves town he simply comes too, and nobody consulted about it
 * is surprised.
 */
export const BANDIT = {
  species: 228,           // Houndour
  nickname: 'Bandit',
  level: 5,
  friendship: 200,
  gender: 'F',

  // In the lab, once the starter is chosen, if it is Sammy holding the phone.
  //
  // She walked up the hill AT YOUR HEEL — she has been beside you since the
  // doorstep — so the Professor cannot be told she has been waiting outside.
  // He is talking about the dog standing in his lab, in front of him.
  arrives: [
    '*The Houndour who followed you up the hill sits down in the middle of the\nlab floor, as though she has been invited.*',
    'Prof. Rowan: And that will be the Houndour.',
    'Prof. Rowan: She came up the hill with you. I watched the pair of you\nfrom the window.',
    'Sammy: That is Bandit. She is not mine exactly. She just lives at our house.',
    'Prof. Rowan: I have been doing this forty years.\fShe is yours exactly.',
    'Prof. Rowan: A Pokémon that picks a person has already made the decision.\fThe paperwork only ever catches up.',
  ],
  joined: [
    '*Bandit walks straight past the Professor, sits on your foot, and looks up.*',
    'Prof. Rowan: Yes. Well. Take her with you, then.',
  ],
  // Matthew's version: Bandit is next door's, and Bandit likes Matthew more
  // than Matthew has ever admitted to liking Bandit.
  matthewMum: [
    'Mum: That Houndour was on our step again this morning.',
    'Mum: I said no. Then I gave her the end of the bacon.\fThat is how these arrangements start.',
    'Mum: She is Sammy\u2019s, really. Everyone knows it but the two of them.',
  ],
  // The line the walking partner gives back when you talk to him.
  talk: [
    'Bandit shoves her whole head under your hand.',
    'Bandit is chewing something. You decide not to ask what.',
    'Bandit looks up at you, then back down the road, then at you again.',
    'Bandit has found a stick considerably larger than Bandit.',
    'Bandit leans her entire weight against your leg and closes her eyes.',
  ],
};

// ---- the person walking with you --------------------------------------------

/**
 * What your companion says when you turn round and talk to them.
 *
 * Conditional like any other NPC's dialogue, so it tracks the story without
 * a special case per beat. The name is filled in by the caller — this is the
 * same list whichever of the two of them is the one following.
 */
export function companionLines(state) {
  const slot = (state && state.companion) || {};
  // Anybody who is not one of the two gets their own short list; the long
  // one below is written for the person the player is actually with.
  if (slot.key && slot.key !== 'matthew' && slot.key !== 'sammy') {
    return [{ lines: ['They give you a nod and keep walking.'] }];
  }
  return [
    {
      when: { flag: 'canalaveTruth' },
      lines: ['I keep thinking about the third book. The four lines somebody added.',
        'Somebody had already done this once. Whatever it was, somebody survived it\nand went back and wrote a warning in the margin.',
        'I do not find that as comforting as I would like to.'],
    },
    {
      when: { flag: 'lakeValor' },
      lines: ['You have not said anything since the lakebed.',
        'You do not have to. I was stood next to you.',
        '...Right. Come on.'],
    },
    {
      when: { flag: 'badge1' },
      pool: [
        ['One badge. ONE. And you are already walking like that.'],
        ['I am fine. My team is fine. Everything is fine.',
          'Ask me again after the next one.'],
        ['Do you want to stop? We can stop. I am not saying I want to stop.'],
      ],
    },
    {
      when: { flag: 'gotStarter' },
      pool: [
        ['Right. So we are doing this.', 'We are actually doing this.'],
        ['I keep checking it is still in the bag. It is still in the bag.'],
        ['Cass has gone on ahead, obviously. She has been gone twenty minutes.',
          'She will be stood somewhere looking annoyed. It is her whole thing.'],
        ['If you get eaten by something in the grass I am going home and\nnot telling anyone.'],
      ],
    },
    { lines: ['Lead on, then. I am right behind you.'] },
  ];
}
