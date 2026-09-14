#!/usr/bin/env python3
"""Bundle the ES modules into one self-contained HTML file.

The game is authored as real ES modules (src/main.js and friends) and runs
that way during development. Publishing it — to a phone, to an Artifact —
needs a single file with no network fetches, so this walks the import graph
and emits every module into one tiny CommonJS-style registry.

Deliberately dependency-free: `python3 build.py` and nothing else.

Import forms supported (the only ones the source uses):
    import { a, b } from './x.js';          (single or multi-line)
    import { a as b } from './x.js';
    import * as ns from './x.js';
    import './x.js';
Export forms supported:
    export function/class/const/let NAME
    export { a, b };
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
ENTRY = "main.js"

IMPORT_RE = re.compile(
    r"^[ \t]*import\s+(?:(?P<clause>\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?"
    r"['\"](?P<path>[^'\"]+)['\"]\s*;?[ \t]*$",
    re.MULTILINE | re.DOTALL,
)
EXPORT_DECL_RE = re.compile(r"^([ \t]*)export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)", re.MULTILINE)
EXPORT_NAME_RE = re.compile(r"^[ \t]*export\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+(\w+)", re.MULTILINE)
EXPORT_LIST_RE = re.compile(r"^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$", re.MULTILINE)


def resolve(importer: str, spec: str) -> str:
    """Resolve a relative specifier to a src-relative module id."""
    if not spec.startswith("."):
        raise SystemExit(f"[build] bare import {spec!r} in {importer} — everything must be local")
    base = (SRC / importer).parent
    target = (base / spec).resolve()
    return str(target.relative_to(SRC.resolve())).replace("\\", "/")


def parse_clause(clause: str) -> tuple[str, list[tuple[str, str]]]:
    """Returns ('named'|'ns'|'side', bindings)."""
    clause = (clause or "").strip()
    if not clause:
        return "side", []
    if clause.startswith("*"):
        return "ns", [(clause.split("as")[1].strip(), "")]
    if clause.startswith("{"):
        out = []
        for part in clause.strip("{}").split(","):
            part = part.strip()
            if not part:
                continue
            if " as " in part:
                src, dst = (x.strip() for x in part.split(" as "))
                out.append((dst, src))
            else:
                out.append((part, part))
        return "named", out
    raise SystemExit(f"[build] unsupported import clause: {clause!r}")


def transform(module_id: str, source: str) -> tuple[str, list[str]]:
    requires: list[str] = []
    deps: list[str] = []

    def take_import(m: re.Match) -> str:
        dep = resolve(module_id, m.group("path"))
        deps.append(dep)
        kind, binds = parse_clause(m.group("clause"))
        if kind == "side":
            requires.append(f"__req({dep!r});")
        elif kind == "ns":
            requires.append(f"const {binds[0][0]} = __req({dep!r});")
        else:
            pairs = ", ".join(a if a == b else f"{b}: {a}" for a, b in binds)
            requires.append(f"const {{ {pairs} }} = __req({dep!r});")
        return ""  # imports are hoisted, so the line is removed here

    body = IMPORT_RE.sub(take_import, source)

    # (local binding, exported name). They differ for `export { a as b }`,
    # and emitting the exported name on both sides produced a getter over an
    # identifier that does not exist — a bundle that parsed fine and threw at
    # boot. Keep the pair.
    pairs: list[tuple[str, str]] = [(n, n) for n in EXPORT_NAME_RE.findall(source)]
    for m in EXPORT_LIST_RE.finditer(source):
        for part in m.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            if " as " in part:
                local, exported = (p.strip() for p in part.split(" as ", 1))
            else:
                local = exported = part
            pairs.append((local, exported))

    body = EXPORT_LIST_RE.sub("", body)
    body = EXPORT_DECL_RE.sub(r"\1", body)

    unique: dict[str, str] = {}
    for local, exported in pairs:
        unique[exported] = local

    # Every exported binding has to exist in the module, either declared in the
    # body or pulled in by an import. Without this a typo or a bad re-export
    # ships a bundle that only fails when the page is opened.
    scope = body + "\n" + "\n".join(requires)
    for exported, local in unique.items():
        if not re.search(rf"\b{re.escape(local)}\b", scope):
            raise SystemExit(
                f"[build] {module_id}: exports {exported!r} but nothing named {local!r} "
                f"is declared or imported in it"
            )

    tail = ""
    if unique:
        tail = "\n__exports(__x, { " + ", ".join(
            f"{exported}: () => {local}" for exported, local in unique.items()
        ) + " });\n"

    # Requires are hoisted to the top, in source order — the same shape ES
    # modules give you, so nothing has to move to be bundled.
    return "\n".join(requires) + "\n" + body + tail, deps


def collect(entry: str) -> list[tuple[str, str]]:
    order: list[tuple[str, str]] = []
    seen: set[str] = set()
    stack: list[str] = []

    def visit(mid: str):
        if mid in seen:
            return
        if mid in stack:
            cycle = " -> ".join(stack[stack.index(mid):] + [mid])
            raise SystemExit(f"[build] circular import: {cycle}")
        stack.append(mid)
        path = SRC / mid
        if not path.exists():
            raise SystemExit(f"[build] missing module: {mid}")
        code, deps = transform(mid, path.read_text(encoding="utf-8"))
        for d in deps:
            visit(d)
        stack.pop()
        seen.add(mid)
        order.append((mid, code))

    visit(entry)
    return order


RUNTIME = """
// --- module runtime (generated by build.py) ---------------------------
const __defs = {};
const __cache = {};
function __req(id) {
  const hit = __cache[id];
  if (hit) return hit.x;
  const rec = { x: {} };
  __cache[id] = rec;
  const def = __defs[id];
  if (!def) throw new Error('missing module ' + id);
  def(rec.x, __req);
  return rec.x;
}
// Exports are installed as getters so a binding assigned later in the module
// body still reads correctly through the namespace object.
function __exports(target, map) {
  for (const k in map) Object.defineProperty(target, k, { get: map[k], enumerable: true });
}
"""


def main() -> int:
    modules = collect(ENTRY)
    parts = [RUNTIME]
    for mid, code in modules:
        parts.append(f"__defs[{mid!r}] = function (__x, __req) {{\n{code}\n}};\n")
    parts.append(f"__req({ENTRY!r});\n")
    script = "\n".join(parts)

    shell = (ROOT / "index.html").read_text(encoding="utf-8")
    # Reuse the dev page's <style> so there is exactly one source of truth.
    style = re.search(r"<style>(.*?)</style>", shell, re.S).group(1)

    out = f"""<meta charset="utf-8">
<title>Glimmer</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0d1020">
<style>{style}</style>
<canvas id="game"></canvas>
<div id="hud"><span>&#9670;</span><b id="lums">0</b></div>
<div id="rotate"><span>&#8635;</span>TURN YOUR PHONE SIDEWAYS</div>
<script>
(function () {{
'use strict';
{script}
}})();
</script>
"""
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    target = dist / "glimmer.html"
    target.write_text(out, encoding="utf-8")
    kb = len(out.encode("utf-8")) / 1024
    print(f"[build] {len(modules)} modules -> {target} ({kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
