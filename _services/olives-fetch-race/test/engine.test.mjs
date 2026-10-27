import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyMove,
  validate,
  legalMoves,
  route,
  distance,
  edge,
  HOMES,
  BALLS,
  ROCKS,
} from "../../../play/olives-fetch-race/engine.mjs";
test("symmetric garden, reachable fetch and return, meaningful detours", () => {
  const s = initialState();
  assert.equal(distance(s, 0), distance(s, 1));
  assert.ok(distance(s, 0) > 12);
  const moves = legalMoves(s, 0, "fence");
  assert.ok(moves.length > 40);
  assert.ok(
    moves.some((m) => {
      const n = applyMove(s, 0, m);
      return (
        distance(n, 1) > distance(s, 1) && distance(n, 0) === distance(s, 0)
      );
    }),
  );
});
test("strict action validation and immutable transitions", () => {
  const s = initialState(),
    saved = structuredClone(s);
  assert.throws(() => applyMove(s, 1, { type: "step", to: 39 }), /partner/);
  for (const m of [
    { type: "step", to: 0 },
    { type: "sprint", to: 30 },
    { type: "step", to: "37" },
    { type: "fence", a: 6, b: 7 },
    { type: "fence", a: 15, b: 16 },
    { type: "wat" },
    { type: "fence", a: 44, b: 46 },
  ])
    assert.ok(validate(s, 0, m));
  const n = applyMove(s, 0, { type: "step", to: 37 });
  assert.equal(n.version, 1);
  assert.equal(n.turn, 1);
  assert.deepEqual(s, saved);
});
test("finite resources, bidirectional fences, no repeat or last-exit fence", () => {
  let s = initialState();
  s.players[0].pos = 36;
  let n = applyMove(s, 0, { type: "sprint", to: 22 });
  assert.equal(n.players[0].sprints, 1);
  s.players[0].sprints = 0;
  assert.match(validate(s, 0, { type: "sprint", to: 22 }), /No sprints/);
  s = initialState();
  s.walls = [edge(44, 43), edge(44, 45)];
  assert.match(
    validate(s, 0, { type: "fence", a: 44, b: 37 }),
    /close a winning route/,
  );
  assert.match(validate(s, 0, { type: "fence", a: 44, b: 43 }), /already/);
  s.players[0].fences = 0;
  assert.match(validate(s, 0, { type: "fence", a: 1, b: 2 }), /No fences/);
  s = initialState();
  s.walls = [edge(44, 37)];
  assert.ok(validate(s, 0, { type: "step", to: 37 }));
  s.players[0].pos = 37;
  assert.ok(validate(s, 0, { type: "step", to: 44 }));
});
test("ball crossing, home crossing, equal-turn tie and winner boundaries", () => {
  let s = initialState();
  s.players[0].pos = 1;
  s = applyMove(s, 0, { type: "sprint", to: 3 });
  assert.equal(s.players[0].ball, true);
  assert.equal(s.players[0].pos, 3);
  s = initialState();
  s.players[0] = { ...s.players[0], pos: 43, ball: true };
  s.players[1] = { ...s.players[1], pos: 45, ball: true };
  s = applyMove(s, 0, { type: "sprint", to: 45 });
  assert.equal(s.players[0].pos, 44);
  assert.equal(s.finalLap, true);
  assert.equal(s.result, null);
  assert.equal(applyMove(s, 1, { type: "step", to: 46 }).result, "tie");
  assert.equal(applyMove(s, 1, { type: "step", to: 38 }).result, 0);
  s = initialState();
  s.turn = 1;
  s.players[1].ball = true;
  s.players[1].pos = 39;
  assert.equal(applyMove(s, 1, { type: "step", to: 46 }).result, 1);
});
test("shared cells and shortest-route game finishes without a clock", () => {
  let s = initialState();
  s.players[1].pos = 37;
  s = applyMove(s, 0, { type: "step", to: 37 });
  assert.equal(s.players[0].pos, s.players[1].pos);
  s = initialState();
  for (let i = 0; i < 100 && s.result === null; i++) {
    const p = s.turn,
      a = s.players[p],
      path = route(s, a.pos, a.ball ? HOMES[p] : BALLS[p]);
    s = applyMove(s, p, { type: "step", to: path[1] });
  }
  assert.equal(s.result, "tie");
});
test("seeded strategy exploration: every accepted fence preserves both full objectives", () => {
  let seed = 8171,
    accepted = 0,
    rejected = 0;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let game = 0; game < 60; game++) {
    let s = initialState();
    for (let t = 0; t < 90 && s.result === null; t++) {
      const p = s.turn;
      for (let a = 0; a < 49; a++)
        for (const b of [a + 1, a + 7]) {
          const m = { type: "fence", a, b };
          if (!validate(s, p, m)) {
            const n = applyMove(s, p, m);
            for (let i = 0; i < 2; i++) {
              const v = n.players[i];
              assert.ok(route(n, v.pos, v.ball ? HOMES[i] : BALLS[i]));
              assert.ok(route(n, BALLS[i], HOMES[i]));
            }
            accepted++;
          } else rejected++;
        }
      const a = s.players[p],
        path = route(s, a.pos, a.ball ? HOMES[p] : BALLS[p]),
        fences = legalMoves(s, p, "fence");
      const choice =
        fences.length && rand(3) === 0
          ? fences[rand(fences.length)]
          : { type: "step", to: path[1] };
      s = applyMove(s, p, choice);
      assert.ok(
        s.players.every(
          (v) => v.fences >= 0 && v.sprints >= 0 && !ROCKS.includes(v.pos),
        ),
      );
    }
    assert.notEqual(s.result, null);
  }
  assert.ok(accepted > 10000);
  assert.ok(rejected > 10000);
  console.log(
    `Checked ${accepted} legal fence continuations; ${rejected} rejected candidates.`,
  );
});
