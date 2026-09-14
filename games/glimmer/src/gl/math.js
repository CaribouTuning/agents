// Just enough linear algebra.
//
// Column-major 4x4 matrices, laid out the way WebGL wants them so they can be
// handed to uniformMatrix4fv without transposing. Everything writes into a
// destination array rather than allocating, because these run a few hundred
// times a frame and a garbage collection pause in a platformer is a missed
// jump.

export function mat4() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function identity(m) {
  m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
  m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
  return m;
}

export function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  return out;
}

/** A camera at `eye` looking at `centre`, with +Y up. */
export function lookAt(out, eye, centre, up) {
  let z0 = eye[0] - centre[0], z1 = eye[1] - centre[1], z2 = eye[2] - centre[2];
  let len = Math.hypot(z0, z1, z2);
  if (len < 1e-6) { z0 = 0; z1 = 0; z2 = 1; len = 1; }
  z0 /= len; z1 /= len; z2 /= len;

  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  len = Math.hypot(x0, x1, x2);
  if (len < 1e-6) { x0 = 1; x1 = 0; x2 = 0; } else { x0 /= len; x1 /= len; x2 /= len; }

  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
  out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
  out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/**
 * The one transform this game needs: move somewhere, turn about the vertical,
 * and scale. Written out rather than composed from three matrix multiplies
 * because it is the innermost thing in the frame.
 */
export function compose(out, px, py, pz, yaw, sx, sy, sz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out[0] = c * sx; out[1] = 0; out[2] = -s * sx; out[3] = 0;
  out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
  out[8] = s * sz; out[9] = 0; out[10] = c * sz; out[11] = 0;
  out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
  return out;
}

/** Rotation about X applied after the yaw, for things that lean or tumble. */
export function composeTilt(out, px, py, pz, yaw, pitch, sx, sy, sz) {
  const cy = Math.cos(yaw), sy2 = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  out[0] = cy * sx; out[1] = sp * sy2 * sx; out[2] = -sy2 * cp * sx; out[3] = 0;
  out[4] = 0; out[5] = cp * sy; out[6] = sp * sy; out[7] = 0;
  out[8] = sy2 * sz; out[9] = -sp * cy * sz; out[10] = cy * cp * sz; out[11] = 0;
  out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
  return out;
}

/**
 * The inverse-transpose of the upper 3x3, for normals.
 *
 * With only uniform-ish scales and a yaw this is nearly the rotation itself,
 * but a squashed hero is a non-uniform scale and without this his lighting
 * slides off him as he lands.
 */
export function normalMatrix(out, m) {
  const a = m[0], b = m[1], c = m[2];
  const d = m[4], e = m[5], f = m[6];
  const g = m[8], hh = m[9], i = m[10];
  const A = e * i - f * hh, B = f * g - d * i, C = d * hh - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-8) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 1; out[5] = 0; out[6] = 0; out[7] = 0; out[8] = 1; return out; }
  const id = 1 / det;
  out[0] = A * id; out[1] = B * id; out[2] = C * id;
  out[3] = (c * hh - b * i) * id; out[4] = (a * i - c * g) * id; out[5] = (b * g - a * hh) * id;
  out[6] = (b * f - c * e) * id; out[7] = (c * d - a * f) * id; out[8] = (a * e - b * d) * id;
  return out;
}

// ---- vectors ---------------------------------------------------------

export const v3 = (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]);

export function len(x, y, z) { return Math.hypot(x, y, z); }

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Move `a` toward `b` by at most `max`. The workhorse of every easing here. */
export function approach(a, b, max) {
  const d = b - a;
  if (Math.abs(d) <= max) return b;
  return a + Math.sign(d) * max;
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
