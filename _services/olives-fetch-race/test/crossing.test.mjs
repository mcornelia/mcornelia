import test from "node:test";
import assert from "node:assert/strict";
import * as old from "./fixtures/classic-engine.mjs";
import {
  initialState,
  boardFor,
  route,
  neighbors,
  distance,
  validate,
  applyMove,
  legalMoves,
  edge,
  RACE_LAYOUTS,
  applyRematch,
} from "../../../play/olives-fetch-race/engine.mjs";
const fresh = () => initialState("crossing-v2");
const mirror = (n) => Math.floor(n / 7) * 7 + 6 - (n % 7);
function allShortest(s, start, target) {
  const dist = new Map([[target, 0]]),
    q = [target];
  for (const n of q)
    for (const b of neighbors(s, n))
      if (!dist.has(b)) {
        dist.set(b, dist.get(n) + 1);
        q.push(b);
      }
  const paths = [];
  function visit(path) {
    const n = path.at(-1);
    if (n === target) {
      paths.push(path);
      return;
    }
    for (const b of neighbors(s, n))
      if (dist.get(b) === dist.get(n) - 1) visit([...path, b]);
  }
  visit([start]);
  return paths;
}
function fastest(s, p) {
  const b = boardFor(s),
    start = { pos: s.players[p].pos, ball: false, sprints: 2, steps: 0 },
    q = [start],
    seen = new Set();
  for (const a of q) {
    if (a.ball && a.pos === b.homes[p]) return a.steps;
    const key = [a.pos, a.ball, a.sprints].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    for (const to of neighbors(s, a.pos))
      q.push({
        pos: to,
        ball: a.ball || to === b.balls[p],
        sprints: a.sprints,
        steps: a.steps + 1,
      });
    if (a.sprints)
      for (const delta of [-14, 14, -2, 2]) {
        const to = a.pos + delta,
          mid = a.pos + delta / 2;
        const view = {
          ...s,
          turn: p,
          players: s.players.map((v, i) =>
            i === p ? { ...v, pos: a.pos, sprints: a.sprints } : v,
          ),
        };
        if (!validate(view, p, { type: "sprint", to })) {
          const ball = a.ball || [mid, to].includes(b.balls[p]);
          q.push({
            pos: ball && [mid, to].includes(b.homes[p]) ? b.homes[p] : to,
            ball,
            sprints: a.sprints - 1,
            steps: a.steps + 1,
          });
        }
      }
  }
  return Infinity;
}
test("crossed targets, symmetric fences/resources, equal walking and sprint opportunity", () => {
  const s = fresh(),
    b = boardFor(s);
  assert.deepEqual(b.homes, [43, 47]);
  assert.deepEqual(b.balls, [5, 1]);
  assert.equal(s.walls.length, 10);
  assert.deepEqual(
    s.players.map((p) => [p.fences, p.sprints]),
    [
      [6, 2],
      [6, 2],
    ],
  );
  assert.equal(mirror(b.homes[0]), b.homes[1]);
  assert.equal(mirror(b.balls[0]), b.balls[1]);
  assert.deepEqual(
    [...b.rocks].map(mirror).sort((a, b) => a - b),
    [...b.rocks].sort((a, b) => a - b),
  );
  assert.deepEqual(
    s.walls.map((w) => edge(...w.split("-").map(Number).map(mirror))).sort(),
    [...s.walls].sort(),
  );
  assert.deepEqual([distance(s, 0), distance(s, 1)], [20, 20]);
  assert.equal(fastest(s, 0), 18);
  assert.equal(fastest(s, 1), 18);
});
test("three equally short crossing choices; no single forced crossing; shortest outbound routes intersect", () => {
  const s = fresh(),
    b = boardFor(s);
  for (const gate of b.crossings) {
    const closed = b.crossings.filter((n) => n !== gate),
      v = { ...s, walls: [...s.walls, ...closed.map((n) => edge(n - 1, n))] };
    for (const p of [0, 1]) {
      const path = route(v, b.homes[p], b.balls[p]);
      assert.equal(path.length - 1, 10);
      assert.ok(path.includes(gate));
    }
  }
  const allClosed = {
    ...s,
    walls: [...s.walls, ...b.crossings.map((n) => edge(n - 1, n))],
  };
  assert.equal(route(allClosed, b.homes[0], b.balls[0]), null);
  const paths = [0, 1].map((p) => allShortest(s, b.homes[p], b.balls[p]));
  for (const a of paths[0])
    for (const b of paths[1]) assert.ok(a.some((n) => b.includes(n)));
  assert.ok(paths.every((p) => p.length > 3));
  console.log(
    `Crossing choices: ${paths[0].length} shortest routes per player; all ${paths[0].length * paths[1].length} opposing shortest-route pairs intersect.`,
  );
});
test("a reachable shared-lane fence forces unequal detours; co-location is legal", () => {
  let s = fresh();
  for (const [p, m] of [
    [0, { type: "step", to: 36 }],
    [1, { type: "step", to: 40 }],
    [0, { type: "step", to: 37 }],
    [1, { type: "sprint", to: 38 }],
  ])
    s = applyMove(s, p, m);
  const next = applyMove(s, 0, { type: "fence", a: 37, b: 38 });
  assert.deepEqual(
    [0, 1].map((p) => distance(next, p) - distance(s, p)),
    [2, 4],
  );
  assert.equal(next.players[0].fences, 5);
  assert.equal(next.turn, 1);
  const shared = applyMove(s, 0, { type: "step", to: 38 });
  assert.equal(shared.players[0].pos, shared.players[1].pos);
  assert.equal(validate(shared, 1, { type: "step", to: 37 }), null);
});
test("cannot close the final crossing or place over a fixed garden fence", () => {
  let s = fresh();
  s = applyMove(s, 0, { type: "fence", a: 9, b: 10 });
  s = applyMove(s, 1, { type: "fence", a: 23, b: 24 });
  assert.match(
    validate(s, 0, { type: "fence", a: 37, b: 38 }),
    /close a winning route/,
  );
  const fixed = fresh().walls[0].split("-").map(Number);
  assert.match(
    validate(fresh(), 0, { type: "fence", a: fixed[0], b: fixed[1] }),
    /already/,
  );
  assert.throws(() => initialState("unknown"), /Unknown/);
});
test("existing untagged races retain byte-equivalent classic transitions and geometry", () => {
  let legacy = old.initialState(),
    current = initialState();
  assert.deepEqual(current, legacy);
  let seed = 191;
  for (let i = 0; i < 120 && legacy.result === null; i++) {
    assert.deepEqual(boardFor(current).homes, old.HOMES);
    assert.deepEqual(boardFor(current).balls, old.BALLS);
    assert.deepEqual(boardFor(current).rocks, old.ROCKS);
    for (const type of ["step", "sprint", "fence"])
      assert.deepEqual(
        legalMoves(current, current.turn, type),
        old.legalMoves(legacy, legacy.turn, type),
      );
    const p = legacy.turn,
      v = legacy.players[p],
      path = old.route(legacy, v.pos, v.ball ? old.HOMES[p] : old.BALLS[p]);
    const fences = old.legalMoves(legacy, p, "fence");
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const action =
      fences.length && seed % 4 === 0
        ? fences[seed % fences.length]
        : { type: "step", to: path[1] };
    legacy = old.applyMove(legacy, p, action);
    current = applyMove(current, p, action);
    assert.deepEqual(current, legacy);
    assert.equal(Object.hasOwn(current, "layout"), false);
  }
  assert.notEqual(current.result, null);
});
test("crossing board: seeded complete games preserve outbound/return routes after every legal fence", () => {
  let seed = 9327,
    accepted = 0,
    rejected = 0;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let game = 0; game < 40; game++) {
    let s = initialState(RACE_LAYOUTS[game % RACE_LAYOUTS.length]);
    const layout = s.layout;
    for (let turn = 0; turn < 160 && s.result === null; turn++) {
      const b = boardFor(s),
        p = s.turn;
      for (let a = 0; a < 49; a++)
        for (const to of [a + 1, a + 7]) {
          const m = { type: "fence", a, b: to };
          if (validate(s, p, m)) {
            rejected++;
            continue;
          }
          const n = applyMove(s, p, m);
          for (const i of [0, 1]) {
            assert.ok(
              route(
                n,
                n.players[i].pos,
                n.players[i].ball ? b.homes[i] : b.balls[i],
              ),
            );
            assert.ok(route(n, b.balls[i], b.homes[i]));
          }
          accepted++;
        }
      const fences = legalMoves(s, p, "fence"),
        a = s.players[p],
        path = route(s, a.pos, a.ball ? b.homes[p] : b.balls[p]);
      s = applyMove(
        s,
        p,
        fences.length && rand(3) === 0
          ? fences[rand(fences.length)]
          : { type: "step", to: path[1] },
      );
      assert.equal(s.layout, layout);
      assert.ok(s.players.every((v) => v.fences >= 0 && v.sprints >= 0));
    }
    assert.notEqual(s.result, null);
  }
  assert.ok(accepted > 10000);
  console.log(
    `Crossing invariant exploration: ${accepted} accepted fence continuations, ${rejected} rejected candidates across 40 completed races.`,
  );
});

test("every rotating garden is symmetric, solvable, offers three equal lanes and shared routes", () => {
  const routeSets = [];
  for (const layout of RACE_LAYOUTS) {
    const s = initialState(layout), b = boardFor(s);
    assert.equal(s.walls.length, 10);
    assert.deepEqual(s.walls.map(w => edge(...w.split("-").map(Number).map(mirror))).sort(), [...s.walls].sort());
    const walking = distance(s, 0);
    assert.equal(distance(s, 1), walking);
    assert.equal(fastest(s, 0), fastest(s, 1));
    assert.equal(fastest(s, 0), walking - 2);
    const paths = [0,1].map(p => allShortest(s, b.homes[p], b.balls[p]));
    for (const a of paths[0]) for (const v of paths[1]) assert.ok(a.some(n => v.includes(n)));
    for (const gate of b.crossings) {
      const v = {...s, walls: [...s.walls, ...b.crossings.filter(n => n !== gate).map(n => edge(n-1,n))]};
      for (const p of [0,1]) assert.equal(route(v,b.homes[p],b.balls[p]).length - 1, walking / 2);
    }
    let v = applyMove(s, 0, {type:"fence", a:9,b:10});
    v = applyMove(v, 1, {type:"fence", a:23,b:24});
    assert.match(validate(v,0,{type:"fence",a:37,b:38}),/close a winning route/);
    routeSets.push(JSON.stringify(paths));
    console.log(`${b.name}: ${walking} walking steps, ${fastest(s,0)} optimal movement turns, ${paths[0].length} shortest routes per player; all opposing pairs intersect.`);
  }
  assert.equal(new Set(routeSets).size, RACE_LAYOUTS.length, "routes actually change, not just decorative fences");
});
test("mutual rematches rotate gardens and starters; invitations never spend turns", () => {
  let s = initialState();
  const seen = [];
  for (let race = 1; race <= 7; race++) {
    const before = s;
    s = applyRematch(s, 0, {type:"request"}, `proposal-${race}`);
    assert.deepEqual(s.players,before.players);
    assert.equal(s.turn,before.turn);
    assert.throws(()=>applyRematch(s,0,{type:"accept",proposal:s.rematch.id}), /partner/);
    assert.throws(()=>applyRematch(s,1,{type:"accept",proposal:"old"}), /no longer/);
    s = applyRematch(s,1,{type:"accept",proposal:s.rematch.id});
    assert.equal(s.race,race);
    assert.equal(s.starter,race%2);
    assert.equal(s.turn,s.starter);
    assert.equal(s.version,before.version+2);
    assert.equal(s.ply,0);
    seen.push(s.layout);
    // Both starting orders preserve equal-turn tie opportunities.
    for(let i=0;i<80 && s.result===null;i++) {
      const p=s.turn,b=boardFor(s),v=s.players[p];
      s=applyMove(s,p,{type:"step",to:route(s,v.pos,v.ball?b.homes[p]:b.balls[p])[1]});
    }
    assert.equal(s.result,"tie");
  }
  assert.deepEqual(seen,RACE_LAYOUTS.concat(RACE_LAYOUTS,RACE_LAYOUTS[0]));
  let active = applyRematch(initialState("crossing-v2"),1,{type:"request"},"cancel-by-move");
  active = applyMove(active,0,{type:"step",to:36});
  assert.equal(active.rematch,undefined);
  const invited = applyRematch(active,0,{type:"request"},"decline");
  const declined = applyRematch(invited,1,{type:"decline",proposal:"decline"});
  assert.deepEqual(declined.players,active.players);
  assert.equal(declined.rematch,undefined);
  assert.equal(declined.turn,active.turn);
});
