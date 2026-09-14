// The renderer, at its lowest level: a context, a shader, and meshes.
//
// Deliberately small and hand-written rather than a library. The whole game
// has to be one self-contained file that works on a phone with no network —
// it is a present, and a present that needs a CDN to be up is a present that
// will one day not work — and a flat-shaded low-poly world needs almost
// nothing from a general engine.

let gl = null;
let canvas = null;

export function getGL() { return gl; }
export function getCanvas() { return canvas; }

export function initGL(cv) {
  canvas = cv;
  gl = cv.getContext('webgl2', { antialias: true, alpha: false, depth: true })
    || cv.getContext('webgl', { antialias: true, alpha: false, depth: true });
  if (!gl) return null;
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return gl;
}

function compile(type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`[gl] ${label} failed to compile:\n${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

/**
 * A compiled program with its uniform and attribute locations already looked
 * up. `getUniformLocation` is not free and calling it per draw is the classic
 * way to make a simple renderer slow for no reason.
 */
export function makeProgram(vsSrc, fsSrc, uniforms, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc, 'vertex shader'));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc, 'fragment shader'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`[gl] program failed to link:\n${gl.getProgramInfoLog(p)}`);
  }
  const u = {};
  for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
  const a = {};
  for (const name of attribs) a[name] = gl.getAttribLocation(p, name);
  return { program: p, u, a };
}

/**
 * A mesh: interleaved position + normal + colour, and an index buffer.
 *
 * Colour lives per VERTEX rather than per draw call, which is what lets one
 * mesh be a whole tree — trunk and leaves in one buffer, one draw — and is
 * the reason this renderer can be this simple and still fill a world.
 */
export function makeMesh(data) {
  const { positions, normals, colors, indices } = data;
  const n = positions.length / 3;
  const inter = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    inter[i * 9] = positions[i * 3];
    inter[i * 9 + 1] = positions[i * 3 + 1];
    inter[i * 9 + 2] = positions[i * 3 + 2];
    inter[i * 9 + 3] = normals[i * 3];
    inter[i * 9 + 4] = normals[i * 3 + 1];
    inter[i * 9 + 5] = normals[i * 3 + 2];
    inter[i * 9 + 6] = colors[i * 3];
    inter[i * 9 + 7] = colors[i * 3 + 1];
    inter[i * 9 + 8] = colors[i * 3 + 2];
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  const big = n > 65535;
  const idx = big ? new Uint32Array(indices) : new Uint16Array(indices);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  return { vbo, ibo, count: indices.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}

const STRIDE = 9 * 4;

export function bindMesh(mesh, attribs) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  gl.enableVertexAttribArray(attribs.aPos);
  gl.vertexAttribPointer(attribs.aPos, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(attribs.aNormal);
  gl.vertexAttribPointer(attribs.aNormal, 3, gl.FLOAT, false, STRIDE, 12);
  gl.enableVertexAttribArray(attribs.aColor);
  gl.vertexAttribPointer(attribs.aColor, 3, gl.FLOAT, false, STRIDE, 24);
}

export function drawMesh(mesh) {
  gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
}

/** '#rrggbb' to the [0..1] triple the buffers want. */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
