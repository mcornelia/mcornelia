import {boardFor, neighbors, validate} from "../../../play/olives-fetch-race/engine.mjs";
export function allShortest(s, start, target) {
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
export function fastest(s, p) {
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
