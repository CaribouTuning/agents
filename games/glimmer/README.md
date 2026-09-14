# Glimmer

A 2D platformer, built beside the Pokémon game in this repo and sharing its
chassis — the fixed-timestep loop, the input layer, the procedural audio, the
save system, the link/room networking and the bundler all came across intact.
Nothing else did: a tile-grid turn-based RPG and a continuous-physics
platformer have almost no game code in common.

## Where it is

A movement test. One field, no enemies, nothing to collect, no reason to be
there. That is deliberate — if running to the far ledge and gliding down off
it is not already a pleasure, the answer is to keep editing the numbers in
`src/game/hero.js`, not to build a world on top of a bad jump.

## The shape it is aiming at

Not Rayman 1's level select. One connected world with ability gates: the
helicopter, the fist, climbing and swimming each open somewhere you already
walked past and could not reach. Which is what Rayman 2 is underneath the 3D,
and the honest way to translate it.

## Running it

    python3 build.py        # -> dist/glimmer.html, one self-contained file
    node tools/feeltest.mjs # the jump arc and the glide, pinned
    node tools/poses.mjs    # one screenshot per pose
    node tools/play.mjs     # drives it and reports where he ended up

## The art

Drawn from shapes at runtime, not blitted from a sheet. A character with no
arms and no legs is a head, a body and four independent parts on springs —
which means the whole thing can be drawn from primitives we own outright,
rather than from anybody's copyrighted sprites. That is a real improvement on
the game next door, which cannot be published publicly for exactly that
reason.
