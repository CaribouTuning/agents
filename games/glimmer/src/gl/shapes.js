// Building meshes out of primitives.
//
// Everything in this world — the hero, the trees, the ruins, the ground — is
// assembled here from boxes, spheres and cones and then frozen into one
// buffer. Nothing is modelled in a tool and nothing is loaded from a file,
// which keeps the game one file, keeps it fast to iterate on, and means every
// shape in it is ours.
//
// A `Builder` accumulates shapes in a local space and hands back a single
// mesh, so a whole tree is one draw call rather than four.

import { rgb, makeMesh } from './gl.js';

export class Builder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.idx = [];
    // A transform stack, so a shape can be placed relative to the part it
    // belongs to rather than in world coordinates.
    this.ox = 0; this.oy = 0; this.oz = 0;
    this.sx = 1; this.sy = 1; this.sz = 1;
    this.stack = [];
  }

  push(x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
    this.stack.push([this.ox, this.oy, this.oz, this.sx, this.sy, this.sz]);
    this.ox += x * this.sx; this.oy += y * this.sy; this.oz += z * this.sz;
    this.sx *= sx; this.sy *= sy; this.sz *= sz;
    return this;
  }

  pop() {
    const s = this.stack.pop();
    [this.ox, this.oy, this.oz, this.sx, this.sy, this.sz] = s;
    return this;
  }

  vert(x, y, z, nx, ny, nz, c) {
    this.pos.push(this.ox + x * this.sx, this.oy + y * this.sy, this.oz + z * this.sz);
    // Normals are not scaled here: every scale in this file is close enough to
    // uniform that renormalising in the shader covers it, and the alternative
    // is an inverse-transpose per shape for no visible gain.
    this.nrm.push(nx, ny, nz);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }

  face(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  build() {
    return makeMesh({
      positions: this.pos, normals: this.nrm, colors: this.col, indices: this.idx,
    });
  }

  /** Vertex count, for budgeting. */
  get size() { return this.pos.length / 3; }
}

const FACES = [
  // [normal, four corners in counter-clockwise order seen from outside]
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
];

/**
 * A box, centred on the current origin, with independent half-extents.
 *
 * `tint` darkens the downward faces slightly. Flat shading plus a constant
 * light leaves vertical faces reading as one flat colour; a little baked
 * ambient occlusion on the underside is what stops a world of boxes looking
 * like a spreadsheet.
 */
export function box(b, hx, hy, hz, colour, tint = 0.18) {
  const c = typeof colour === 'string' ? rgb(colour) : colour;
  for (const [n, corners] of FACES) {
    const lift = n[1] > 0 ? 0.08 : n[1] < 0 ? -tint : 0;
    const cc = [
      Math.max(0, Math.min(1, c[0] * (1 + lift))),
      Math.max(0, Math.min(1, c[1] * (1 + lift))),
      Math.max(0, Math.min(1, c[2] * (1 + lift))),
    ];
    const v = corners.map(([x, y, z]) => b.vert(x * hx, y * hy, z * hz, n[0], n[1], n[2], cc));
    b.quad(v[0], v[1], v[2], v[3]);
  }
}

/**
 * A UV sphere. Low band counts on purpose: this is a faceted world and a
 * smooth sphere would be the only smooth thing in it.
 */
export function sphere(b, r, colour, rings = 8, segs = 12, squashY = 1) {
  const c = typeof colour === 'string' ? rgb(colour) : colour;
  const rows = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    const y = Math.cos(phi), rr = Math.sin(phi);
    const row = [];
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
      // A touch of vertical shading baked in, so a sphere reads as round even
      // under a single flat light.
      const k = 1 + y * 0.09;
      row.push(b.vert(x * r, y * r * squashY, z * r, x, y, z,
        [c[0] * k, c[1] * k, c[2] * k]));
    }
    rows.push(row);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      // Across the row first, THEN down. The other order winds every quad
      // inward, which back-face culling turns into "you can see through the
      // near side of the ball and are looking at the inside of the far side".
      b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
    }
  }
}

/** A cone or a cylinder, depending on the two radii. Y is up. */
export function tube(b, rBottom, rTop, height, colour, segs = 10, capTop = true) {
  const c = typeof colour === 'string' ? rgb(colour) : colour;
  const y0 = 0, y1 = height;
  const lower = [], upper = [];
  for (let j = 0; j <= segs; j++) {
    const th = (j / segs) * Math.PI * 2;
    const cx = Math.cos(th), cz = Math.sin(th);
    const dark = [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9];
    lower.push(b.vert(cx * rBottom, y0, cz * rBottom, cx, 0.2, cz, dark));
    upper.push(b.vert(cx * rTop, y1, cz * rTop, cx, 0.2, cz, c));
  }
  for (let j = 0; j < segs; j++) {
    b.quad(lower[j], upper[j], upper[j + 1], lower[j + 1]);
  }
  if (capTop && rTop > 0.001) {
    const mid = b.vert(0, y1, 0, 0, 1, 0, c);
    const ring = [];
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      ring.push(b.vert(Math.cos(th) * rTop, y1, Math.sin(th) * rTop, 0, 1, 0, c));
    }
    for (let j = 0; j < segs; j++) b.face(mid, ring[j + 1], ring[j]);
  }
}

/**
 * A patch of ground: a grid with a height function, flat-shaded.
 *
 * Each quad gets its own four vertices so neighbouring quads do not share
 * normals. That is four times the vertices of a smooth mesh and it is the
 * entire look: hard facets catching the light at different angles is what
 * makes low-poly ground read as landscape rather than as a bedsheet.
 */
export function groundPatch(b, w, d, cols, rowsN, heightAt, colourAt) {
  const dx = w / cols, dz = d / rowsN;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rowsN; j++) {
      const x0 = -w / 2 + i * dx, x1 = x0 + dx;
      const z0 = -d / 2 + j * dz, z1 = z0 + dz;
      const p = [
        [x0, heightAt(x0, z0), z0],
        [x1, heightAt(x1, z0), z0],
        [x1, heightAt(x1, z1), z1],
        [x0, heightAt(x0, z1), z1],
      ];
      // Two triangles, each with a true face normal. The corner order runs
      // clockwise seen from above, so the triangles are taken backwards to
      // come out facing the sky — wound the other way the whole meadow is
      // culled and you stand on the soil slab underneath it.
      for (const tri of [[0, 2, 1], [0, 3, 2]]) {
        const a = p[tri[0]], bb = p[tri[1]], cc = p[tri[2]];
        const ux = bb[0] - a[0], uy = bb[1] - a[1], uz = bb[2] - a[2];
        const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        const col = colourAt((a[0] + bb[0] + cc[0]) / 3, (a[2] + bb[2] + cc[2]) / 3, ny);
        const i0 = b.vert(a[0], a[1], a[2], nx, ny, nz, col);
        const i1 = b.vert(bb[0], bb[1], bb[2], nx, ny, nz, col);
        const i2 = b.vert(cc[0], cc[1], cc[2], nx, ny, nz, col);
        b.face(i0, i1, i2);
      }
    }
  }
}

/** A flat disc lying on the XZ plane. Shadows, lily pads, platform tops. */
export function disc(b, r, colour, segs = 14, y = 0) {
  const c = typeof colour === 'string' ? rgb(colour) : colour;
  const mid = b.vert(0, y, 0, 0, 1, 0, c);
  const ring = [];
  for (let j = 0; j <= segs; j++) {
    const th = (j / segs) * Math.PI * 2;
    ring.push(b.vert(Math.cos(th) * r, y, Math.sin(th) * r, 0, 1, 0, c));
  }
  for (let j = 0; j < segs; j++) b.face(mid, ring[j + 1], ring[j]);
}

/**
 * A faceted gem: a ring of vertices with a point above and below.
 *
 * Every face gets its own three vertices and its true normal, so the facets
 * catch the light separately and the thing glitters as it turns. That is the
 * entire reason a collectible is this shape and not a ball.
 */
export function gem(b, r, h, colour, segs = 6) {
  const c = typeof colour === 'string' ? rgb(colour) : colour;
  const ring = [];
  for (let j = 0; j < segs; j++) {
    const th = (j / segs) * Math.PI * 2;
    ring.push([Math.cos(th) * r, 0, Math.sin(th) * r]);
  }
  const tri = (A, B, C, tint) => {
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let nx = u[1] * v[2] - u[2] * v[1];
    let ny = u[2] * v[0] - u[0] * v[2];
    let nz = u[0] * v[1] - u[1] * v[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const cc = [Math.min(1, c[0] * tint), Math.min(1, c[1] * tint), Math.min(1, c[2] * tint)];
    const i0 = b.vert(A[0], A[1], A[2], nx, ny, nz, cc);
    const i1 = b.vert(B[0], B[1], B[2], nx, ny, nz, cc);
    const i2 = b.vert(C[0], C[1], C[2], nx, ny, nz, cc);
    b.face(i0, i1, i2);
  };
  const top = [0, h, 0], bot = [0, -h * 0.72, 0];
  for (let j = 0; j < segs; j++) {
    const a = ring[j], d = ring[(j + 1) % segs];
    tri(d, a, top, 1.12);
    tri(a, d, bot, 0.82);
  }
}
