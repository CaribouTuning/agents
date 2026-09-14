// The frame: one shader, one light, and a draw list.
//
// Flat-shaded low-poly with distance fog. That is the whole look, and it was
// picked because it is honest about what it is — a world built from a few
// thousand triangles reads as deliberate when it is faceted and as cheap when
// it is trying to be smooth — and because it makes every surface in the game
// something we can describe in a line of code.

import { getGL, makeProgram, bindMesh, drawMesh, rgb } from '../gl/gl.js';
import { mat4, perspective, lookAt, multiply, compose, composeTilt, normalMatrix } from '../gl/math.js';

const VS = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormal;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
varying float vHeight;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 eye = uView * world;
  gl_Position = uProj * eye;
  vNormal = normalize(uNormal * aNormal);
  vColor = aColor;
  vDepth = -eye.z;
  vHeight = world.y;
}`;

const FS = `
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
varying float vHeight;
uniform vec3 uLightDir;
uniform vec3 uSun;
uniform vec3 uSky;
uniform vec3 uBounce;
uniform vec3 uFog;
uniform vec2 uFogRange;
uniform float uAlpha;
void main() {
  vec3 n = normalize(vNormal);
  // Three lights, none of them a point: a sun, a sky dome that only lights
  // what faces up, and a warm bounce off the ground that only lights what
  // faces down. Cheap, and it is what keeps the shaded sides of things from
  // going flat grey.
  float sun = max(dot(n, uLightDir), 0.0);
  float sky = max(n.y, 0.0) * 0.5 + 0.5;
  float bounce = max(-n.y, 0.0);
  vec3 lit = vColor * (uSun * sun + uSky * sky + uBounce * bounce * 0.35);
  // A whisper of rim light so silhouettes separate from the background.
  lit += uSky * pow(1.0 - max(n.z, 0.0), 3.0) * 0.04;
  float fog = clamp((vDepth - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  fog *= fog;
  gl_FragColor = vec4(mix(lit, uFog, fog), uAlpha);
}`;

const UNIFORMS = ['uProj', 'uView', 'uModel', 'uNormal', 'uLightDir', 'uSun',
  'uSky', 'uBounce', 'uFog', 'uFogRange', 'uAlpha'];
const ATTRIBS = ['aPos', 'aNormal', 'aColor'];

export class Scene {
  constructor() {
    const gl = getGL();
    this.gl = gl;
    const p = makeProgram(VS, FS, UNIFORMS, ATTRIBS);
    this.prog = p.program;
    this.u = p.u;
    this.a = p.a;

    this.proj = mat4();
    this.view = mat4();
    this.model = mat4();
    this.nrm = new Float32Array(9);

    this.eye = [0, 6, 12];
    this.target = [0, 1, 0];

    // Late afternoon, low and warm, because that is the light the reference
    // lives in and because long shadows make a low-poly world look modelled.
    this.lightDir = norm([0.42, 0.78, 0.45]);
    this.sun = rgb('#fff0d0');
    this.sky = rgb('#8fb8e8');
    this.bounce = rgb('#d8b98a');
    this.fog = rgb('#bcdcf0');
    this.fogNear = 34;
    this.fogFar = 130;
    this.fov = 1.02;
  }

  /** Sets the background and the fog to the same colour, so they meet. */
  clear(w, h) {
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    gl.clearColor(this.fog[0], this.fog[1], this.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  begin(w, h) {
    const gl = this.gl;
    perspective(this.proj, this.fov, w / h, 0.1, 400);
    lookAt(this.view, this.eye, this.target, [0, 1, 0]);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.u.uView, false, this.view);
    gl.uniform3fv(this.u.uLightDir, this.lightDir);
    gl.uniform3fv(this.u.uSun, this.sun);
    gl.uniform3fv(this.u.uSky, this.sky);
    gl.uniform3fv(this.u.uBounce, this.bounce);
    gl.uniform3fv(this.u.uFog, this.fog);
    gl.uniform2f(this.u.uFogRange, this.fogNear, this.fogFar);
    gl.uniform1f(this.u.uAlpha, 1);
    this.bound = null;
  }

  /** Draws a mesh at a position, turned about the vertical, scaled. */
  draw(mesh, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, alpha = 1, pitch = 0) {
    const gl = this.gl;
    if (this.bound !== mesh) { bindMesh(mesh, this.a); this.bound = mesh; }
    if (pitch) composeTilt(this.model, x, y, z, yaw, pitch, sx, sy, sz);
    else compose(this.model, x, y, z, yaw, sx, sy, sz);
    normalMatrix(this.nrm, this.model);
    gl.uniformMatrix4fv(this.u.uModel, false, this.model);
    gl.uniformMatrix3fv(this.u.uNormal, false, this.nrm);
    if (alpha !== this.lastAlpha) { gl.uniform1f(this.u.uAlpha, alpha); this.lastAlpha = alpha; }
    drawMesh(mesh);
  }

  /** Where a world point lands on screen, for name tags and markers. */
  project(x, y, z, w, h) {
    const mv = mat4();
    multiply(mv, this.proj, this.view);
    const cx = mv[0] * x + mv[4] * y + mv[8] * z + mv[12];
    const cy = mv[1] * x + mv[5] * y + mv[9] * z + mv[13];
    const cw = mv[3] * x + mv[7] * y + mv[11] * z + mv[15];
    if (cw <= 0.0001) return null;
    return { x: (cx / cw * 0.5 + 0.5) * w, y: (1 - (cy / cw * 0.5 + 0.5)) * h };
  }
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return new Float32Array([v[0] / l, v[1] / l, v[2] / l]);
}
