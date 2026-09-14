// Winding test.
//
// Every triangle in this game is drawn with back-face culling on, so a face
// wound the wrong way is not "slightly wrong" — it is invisible, and you see
// whatever is behind it. That is a bug you cannot spot by reading the code,
// because the winding is three indices in a list and the normal is three
// floats somewhere else.
//
// So: build one of everything, compute each triangle's TRUE normal from its
// three corners, and check it agrees with the normal the shader will use. If
// they disagree the face is inside out.

import { Builder, box, sphere, tube, groundPatch, disc } from '../src/gl/shapes.js';

function check(name, build) {
  const b = new Builder();
  build(b);
  let bad = 0, total = 0;
  for (let i = 0; i < b.idx.length; i += 3) {
    const [ia, ib, ic] = [b.idx[i], b.idx[i + 1], b.idx[i + 2]];
    const p = (k) => [b.pos[k * 3], b.pos[k * 3 + 1], b.pos[k * 3 + 2]];
    const A = p(ia), B = p(ib), C = p(ic);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) continue;           // a degenerate sliver at a sphere pole
    total++;
    // The average of the three stored normals is where the face claims to point.
    let a = [0, 0, 0];
    for (const k of [ia, ib, ic]) {
      a[0] += b.nrm[k * 3]; a[1] += b.nrm[k * 3 + 1]; a[2] += b.nrm[k * 3 + 2];
    }
    const al = Math.hypot(a[0], a[1], a[2]);
    if (al < 1e-9) continue;
    const dot = (n[0] * a[0] + n[1] * a[1] + n[2] * a[2]) / (l * al);
    if (dot < 0.1) bad++;
  }
  const ok = bad === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(14)} ${total - bad}/${total} faces wound outward`);
  return ok;
}

let pass = true;
pass &= check('box', (b) => box(b, 1, 1, 1, '#ffffff'));
pass &= check('sphere', (b) => sphere(b, 1, '#ffffff', 8, 12));
pass &= check('sphere squash', (b) => sphere(b, 1, '#ffffff', 6, 8, 0.4));
pass &= check('cylinder', (b) => tube(b, 1, 1, 2, '#ffffff', 10, true));
pass &= check('cone', (b) => tube(b, 1, 0.02, 2, '#ffffff', 8, false));
pass &= check('disc', (b) => disc(b, 1, '#ffffff', 14, 0));
pass &= check('groundPatch', (b) => groundPatch(b, 4, 4, 4, 4,
  (x, z) => Math.sin(x) * 0.1, () => [1, 1, 1]));

// The patch derives its normals from its own corners, so the check above
// passes even when every face points at the floor — which is exactly the bug
// that made the first meadow brown. Ground has to face the sky, and that is a
// separate claim needing a separate test.
{
  const b = new Builder();
  groundPatch(b, 4, 4, 4, 4, (x, z) => Math.sin(x) * 0.1, () => [1, 1, 1]);
  let down = 0;
  for (let k = 0; k < b.nrm.length; k += 3) if (b.nrm[k + 1] <= 0) down++;
  const ok = down === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${'ground faces up'.padEnd(14)} `
    + `${b.nrm.length / 3 - down}/${b.nrm.length / 3} normals point skyward`);
  pass &= ok;
}

console.log(pass ? '\nall primitives face outward' : '\nINSIDE-OUT GEOMETRY');
process.exit(pass ? 0 : 1);
