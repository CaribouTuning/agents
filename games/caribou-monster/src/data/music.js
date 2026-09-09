// Music, as data.
//
// Each track is four channels of note tokens (see core/audio.js for the
// format). Nothing is fetched — the synth builds these at runtime, so the
// whole soundtrack costs a few kilobytes of text.
//
// Token: NOTE:LENGTH in sixteenths, '-' rests, '|' is a bar mark for reading.
// Drums use pitch to pick a voice: C1 = kick, C6 = hat, G3 = snare.

const K = 'C1', H = 'C6', S = 'G3';

const song = (bpm, lead, harmony, bass, drums) => ({
  bpm, channels: { lead, harmony, bass, drums },
});

// A four-on-the-floor-ish pattern reused by the calmer tracks.
const beatCalm = `${K}:4 ${H}:4 ${S}:4 ${H}:4 | ${K}:4 ${H}:4 ${S}:4 ${H}:2 ${H}:2`;
const beatDrive = `${K}:2 ${H}:2 ${S}:2 ${H}:2 ${K}:2 ${H}:2 ${S}:2 ${H}:2`;

export const MUSIC = {
  title: song(96,
    'E5:4 G5:4 B5:6 A5:2 | G5:4 E5:4 D5:8 | C5:4 E5:4 G5:6 A5:2 | B5:8 -:8',
    'B4:8 E5:8 | B4:8 G4:8 | C5:8 E5:8 | G5:8 -:8',
    'E2:8 E2:8 | C2:8 C2:8 | A2:8 A2:8 | B2:8 B2:8',
    `${K}:8 -:8 | ${K}:8 -:8 | ${K}:8 -:8 | ${K}:4 ${S}:4 ${K}:4 ${S}:4`),

  home: song(104,
    'C5:4 E5:4 G5:4 E5:4 | F5:4 E5:4 D5:8 | C5:4 E5:4 A5:4 G5:4 | E5:8 -:8',
    'E4:8 C4:8 | A4:8 B4:8 | C5:8 E5:8 | C5:8 -:8',
    'C2:8 G2:8 | F2:8 G2:8 | A2:8 E2:8 | C2:8 G2:8',
    `${K}:8 ${H}:8 | ${K}:8 ${H}:8 | ${K}:8 ${H}:8 | ${K}:8 ${H}:8`),

  town: song(120,
    'G4:2 A4:2 B4:4 D5:4 B4:4 | A4:2 B4:2 A4:4 G4:8 | E4:2 G4:2 A4:4 C5:4 A4:4 | G4:6 D4:2 G4:8',
    'D4:4 D4:4 G4:4 G4:4 | C4:4 D4:4 D4:8 | C4:4 E4:4 E4:4 E4:4 | D4:8 D4:8',
    'G2:4 D3:4 G2:4 D3:4 | C3:4 G2:4 D3:8 | A2:4 E3:4 A2:4 E3:4 | G2:4 D3:4 G2:8',
    `${beatCalm} | ${beatCalm}`),

  city: song(132,
    'C5:2 D5:2 E5:2 G5:2 E5:4 D5:4 | C5:2 D5:2 E5:4 G5:4 A5:4 | B4:2 C5:2 D5:4 F5:4 D5:4 | C5:8 -:4 G4:4',
    'E4:4 G4:4 C5:4 G4:4 | E4:4 A4:4 C5:8 | D4:4 F4:4 A4:8 | E4:8 E4:8',
    'C3:2 C3:2 G2:2 C3:2 F2:4 G2:4 | C3:2 C3:2 A2:4 F2:4 G2:4 | D3:2 D3:2 B2:4 G2:8 | C3:4 G2:4 C3:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  route: song(140,
    'D5:2 F5:2 A5:4 G5:2 F5:2 D5:4 | C5:2 E5:2 G5:4 F5:4 D5:4 | A4:2 D5:2 F5:4 A5:4 G5:4 | F5:4 D5:4 D5:8',
    'A4:4 D5:4 F4:4 A4:4 | G4:4 C5:4 E4:8 | D4:4 A4:4 D5:8 | A4:8 D4:8',
    'D3:2 D3:2 A2:2 D3:2 F2:4 A2:4 | C3:2 C3:2 G2:4 C3:4 E3:4 | D3:2 D3:2 A2:4 D3:8 | A2:4 D3:4 D3:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  forest: song(112,
    'A4:4 C5:4 E5:4 D5:4 | C5:4 A4:4 G4:8 | E4:4 A4:4 C5:4 B4:4 | A4:8 -:8',
    'E4:8 A4:8 | E4:8 D4:8 | C4:8 E4:8 | A4:8 -:8',
    'A2:8 E3:8 | F2:8 G2:8 | C3:8 E3:8 | A2:8 A2:8',
    `${K}:8 ${H}:4 ${H}:4 | ${K}:8 ${H}:8 | ${K}:8 ${H}:4 ${H}:4 | ${K}:8 ${H}:8`),

  cave: song(96,
    'D4:6 F4:2 A4:8 | G4:6 E4:2 D4:8 | A3:6 D4:2 F4:8 | E4:8 D4:8',
    '-:16 | A3:8 C4:8 | -:16 | A3:8 -:8',
    'D2:8 D2:8 | Bb2:8 Bb2:8 | F2:8 F2:8 | A2:8 A2:8',
    `${K}:16 | ${K}:8 ${S}:8 | ${K}:16 | ${K}:8 ${S}:8`),

  gym: song(150,
    'E4:2 E4:2 G4:2 E4:2 A4:4 G4:4 | E4:2 E4:2 G4:2 A4:2 B4:8 | D5:2 B4:2 A4:2 G4:2 E4:8 | D4:4 E4:4 E4:8',
    'B3:4 B3:4 E4:4 E4:4 | B3:4 E4:4 G4:8 | G4:4 E4:4 B3:8 | A3:8 B3:8',
    'E2:2 E2:2 E2:2 E2:2 A2:4 G2:4 | E2:2 E2:2 E2:4 B2:4 B2:4 | G2:2 G2:2 E2:4 E2:8 | A2:4 B2:4 E2:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  center: song(108,
    'F5:4 E5:4 C5:8 | D5:4 C5:4 A4:8 | F4:4 A4:4 C5:4 E5:4 | F5:8 -:8',
    'C5:8 G4:8 | A4:8 F4:8 | C4:8 A4:8 | C5:8 -:8',
    'F2:8 C3:8 | D2:8 A2:8 | F2:8 A2:8 | F2:8 C3:8',
    `-:16 | -:16 | -:16 | -:16`),

  mart: song(126,
    'G5:2 -:2 G5:2 -:2 E5:4 G5:4 | A5:2 -:2 A5:2 -:2 G5:8 | E5:2 -:2 E5:2 -:2 D5:4 E5:4 | G5:8 -:8',
    'D5:4 D5:4 C5:8 | E5:4 E5:4 D5:8 | C5:4 C5:4 B4:8 | D5:8 -:8',
    'G2:4 D3:4 C3:4 D3:4 | A2:4 E3:4 D3:8 | C3:4 G2:4 G2:8 | G2:4 D3:4 G2:8',
    `${K}:4 ${H}:4 ${K}:4 ${H}:4 | ${K}:4 ${H}:4 ${K}:4 ${H}:4 | ${K}:4 ${H}:4 ${K}:4 ${H}:4 | ${K}:4 ${H}:4 ${K}:4 ${H}:4`),

  lab: song(100,
    'C5:4 D5:2 E5:2 G5:8 | F5:4 E5:2 D5:2 C5:8 | A4:4 C5:2 D5:2 E5:8 | D5:8 C5:8',
    'G4:8 C5:8 | A4:8 G4:8 | F4:8 A4:8 | G4:8 G4:8',
    'C2:8 G2:8 | F2:8 C3:8 | A2:8 E2:8 | G2:8 C2:8',
    `${K}:8 ${H}:8 | ${K}:8 ${H}:8 | ${K}:8 ${H}:8 | ${K}:8 ${H}:8`),

  battleWild: song(160,
    'A4:2 A4:2 C5:2 A4:2 E5:4 D5:4 | C5:2 C5:2 E5:2 C5:2 A5:8 | G5:2 E5:2 D5:2 C5:2 A4:8 | B4:4 C5:4 A4:8',
    'E4:2 E4:2 A4:4 C5:4 A4:4 | A4:2 A4:2 C5:4 E5:8 | E5:4 C5:4 A4:8 | E4:8 A4:8',
    'A2:2 A2:2 A2:2 A2:2 E2:4 D2:4 | C2:2 C2:2 C2:4 A2:8 | G2:2 G2:2 D2:4 A2:8 | E2:4 E2:4 A2:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  battleTrainer: song(168,
    'D5:2 D5:2 F5:2 D5:2 A5:4 G5:4 | F5:2 F5:2 A5:2 F5:2 D6:8 | C6:2 A5:2 G5:2 F5:2 D5:8 | E5:4 F5:4 D5:8',
    'A4:2 A4:2 D5:4 F5:4 D5:4 | D5:2 D5:2 F5:4 A5:8 | A5:4 F5:4 D5:8 | A4:8 D5:8',
    'D2:2 D2:2 D2:2 D2:2 A2:4 G2:4 | F2:2 F2:2 F2:4 D2:8 | C2:2 C2:2 G2:4 D2:8 | A2:4 A2:4 D2:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  battleGym: song(176,
    'E5:2 E5:2 G5:2 B5:2 A5:4 G5:4 | E5:2 G5:2 B5:2 E6:2 D6:8 | C6:2 B5:2 A5:2 G5:2 E5:8 | F5:4 G5:4 E5:8',
    'B4:2 B4:2 E5:4 G5:4 E5:4 | E5:2 E5:2 G5:4 B5:8 | B5:4 G5:4 E5:8 | B4:8 E5:8',
    'E2:2 E2:2 E2:2 E2:2 B2:4 A2:4 | G2:2 G2:2 G2:4 E2:8 | C2:2 C2:2 A2:4 E2:8 | B2:4 B2:4 E2:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  battlePvp: song(172,
    'C5:2 E5:2 G5:2 C6:2 B5:4 G5:4 | A5:2 F5:2 C5:2 A5:2 G5:8 | E5:2 G5:2 C6:2 E6:2 D6:8 | C6:4 G5:4 C5:8',
    'G4:2 C5:2 E5:4 G5:4 E5:4 | F4:2 A4:2 C5:4 E5:8 | C5:4 E5:4 G5:8 | E5:8 C5:8',
    'C2:2 C2:2 C2:2 C2:2 G2:4 F2:4 | F2:2 F2:2 A2:4 C3:8 | C2:2 C2:2 G2:4 C3:8 | G2:4 G2:4 C2:8',
    `${beatDrive} | ${beatDrive} | ${beatDrive} | ${beatDrive}`),

  victory: song(150,
    'C5:2 C5:2 C5:2 C5:4 E5:2 D5:4 | E5:2 F5:2 G5:8 -:4 | C5:2 C5:2 C5:2 C5:4 E5:2 G5:4 | C6:12 -:4',
    'E4:2 E4:2 E4:2 E4:4 G4:2 F4:4 | G4:2 A4:2 C5:8 -:4 | E4:2 E4:2 E4:2 E4:4 G4:2 C5:4 | E5:12 -:4',
    'C2:4 C2:4 C2:4 G2:4 | C3:8 G2:8 | C2:4 C2:4 E2:4 G2:4 | C2:16',
    `${K}:2 ${K}:2 ${K}:2 ${K}:2 ${S}:8 | ${K}:8 ${S}:8 | ${K}:4 ${K}:4 ${S}:4 ${S}:4 | ${K}:4 ${S}:4 ${K}:4 ${S}:4`),

  meridian: song(128,
    'A4:6 A4:2 G4:8 | F4:6 F4:2 E4:8 | D4:6 F4:2 A4:8 | G4:8 E4:8',
    'E4:8 D4:8 | C4:8 B3:8 | A3:8 C4:8 | D4:8 E4:8',
    'A1:8 A1:8 | F1:8 F1:8 | D1:8 D1:8 | E1:8 E1:8',
    `${K}:8 ${K}:8 | ${K}:8 ${K}:8 | ${K}:8 ${K}:8 | ${K}:4 ${S}:4 ${K}:4 ${S}:4`),
};

const ALIASES = {
  town: 'town', city: 'city', route: 'route', forest: 'forest', cave: 'cave',
  gym: 'gym', center: 'center', mart: 'mart', home: 'home', lab: 'lab',
  title: 'title', victory: 'victory',
};

export function musicFor(key) {
  return MUSIC[ALIASES[key] || key] || MUSIC.route;
}

export function battleMusic(kind, opts = {}) {
  if (kind === 'pvp') return MUSIC.battlePvp;
  if (opts.leader) return MUSIC.battleGym;
  if (opts.villain) return MUSIC.meridian;
  if (kind === 'trainer') return MUSIC.battleTrainer;
  return MUSIC.battleWild;
}

export function battleMusicKey(kind, opts = {}) {
  if (kind === 'pvp') return 'battlePvp';
  if (opts.leader) return 'battleGym';
  if (opts.villain) return 'meridian';
  if (kind === 'trainer') return 'battleTrainer';
  return 'battleWild';
}
