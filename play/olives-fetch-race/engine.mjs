export const SIZE = 7,
  NAMES = ["Mike", "Aimee"],
  HOMES = [44, 46],
  BALLS = [2, 4],
  ROCKS = [16, 18, 24, 30, 32];
export const edge = (a, b) => [a, b].sort((x, y) => x - y).join("-");
export const cellName = (n) => `${"ABCDEFG"[n % 7]}${Math.floor(n / 7) + 1}`;
export function initialState() {
  return {
    schema: 1,
    version: 0,
    turn: 0,
    players: HOMES.map((pos) => ({
      pos,
      ball: false,
      fences: 6,
      sprints: 2,
      finished: false,
    })),
    walls: [edge(2, 9), edge(4, 11)],
    result: null,
    finalLap: false,
    last: "The garden is ready. Mike takes the first turn.",
  };
}
export const validCell = (n) =>
  Number.isInteger(n) && n >= 0 && n < 49 && !ROCKS.includes(n);
export function adjacent(a, b) {
  return (
    validCell(a) &&
    validCell(b) &&
    Math.abs((a % 7) - (b % 7)) +
      Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) ===
      1
  );
}
export function neighbors(s, n) {
  return [n - 7, n + 7, n - 1, n + 1].filter(
    (b) => adjacent(n, b) && !s.walls.includes(edge(n, b)),
  );
}
export function route(s, from, to) {
  const q = [from],
    prev = new Map([[from, null]]);
  for (const n of q) {
    if (n === to) {
      const path = [];
      for (let k = n; k !== null; k = prev.get(k)) path.unshift(k);
      return path;
    }
    for (const b of neighbors(s, n))
      if (!prev.has(b)) {
        prev.set(b, n);
        q.push(b);
      }
  }
  return null;
}
export function distance(s, p) {
  const a = s.players[p];
  if (a.finished) return 0;
  const first = route(s, a.pos, a.ball ? HOMES[p] : BALLS[p]);
  const second = a.ball ? null : route(s, BALLS[p], HOMES[p]);
  return first ? first.length - 1 + (second ? second.length - 1 : 0) : Infinity;
}
export function validate(s, p, m) {
  if (s.result !== null) return "The race is complete.";
  if (p !== s.turn) return "It is your partner’s turn.";
  if (!m || !["step", "sprint", "fence"].includes(m.type))
    return "Choose a move, sprint, or fence.";
  const a = s.players[p];
  if (m.type === "step")
    return neighbors(s, a.pos).includes(m.to)
      ? null
      : "Walk to a highlighted neighboring square.";
  if (m.type === "sprint") {
    if (!a.sprints) return "No sprints left. Save your legs and walk.";
    const d = m.to - a.pos,
      mid = a.pos + d / 2;
    return [14, -14, 2, -2].includes(d) &&
      adjacent(a.pos, mid) &&
      adjacent(mid, m.to) &&
      neighbors(s, a.pos).includes(mid) &&
      neighbors(s, mid).includes(m.to)
      ? null
      : "Sprint two clear squares in a straight line.";
  }
  if (!a.fences) return "No fences left.";
  if (!adjacent(m.a, m.b))
    return "A fence belongs between two neighboring lawn squares.";
  if (s.walls.includes(edge(m.a, m.b)))
    return "There is already a fence there.";
  const next = { ...s, walls: [...s.walls, edge(m.a, m.b)] };
  for (let i = 0; i < 2; i++) {
    const v = s.players[i];
    if (
      !route(next, v.pos, v.ball ? HOMES[i] : BALLS[i]) ||
      !route(next, BALLS[i], HOMES[i])
    )
      return "That fence would close a winning route. Leave a way through.";
  }
  return null;
}
export function legalMoves(s, p = s.turn, type = "step") {
  const moves = [];
  if (type === "fence") {
    for (let a = 0; a < 49; a++)
      for (const b of [a + 1, a + 7]) {
        const m = { type, a, b };
        if (!validate(s, p, m)) moves.push(m);
      }
  } else
    for (let to = 0; to < 49; to++) {
      const m = { type, to };
      if (!validate(s, p, m)) moves.push(m);
    }
  return moves;
}
export function applyMove(s, p, m) {
  const error = validate(s, p, m);
  if (error) throw Error(error);
  const next = structuredClone(s),
    a = next.players[p];
  let detail;
  if (m.type === "fence") {
    next.walls.push(edge(m.a, m.b));
    a.fences--;
    detail = `placed a fence between ${cellName(m.a)} and ${cellName(m.b)}`;
  } else {
    const crossed =
      m.type === "sprint" ? [a.pos + (m.to - a.pos) / 2, m.to] : [m.to];
    a.pos = m.to;
    if (m.type === "sprint") a.sprints--;
    const got = !a.ball && crossed.includes(BALLS[p]);
    if (got) a.ball = true;
    detail = `${m.type === "sprint" ? "sprinted" : "walked"} to ${cellName(m.to)}${got ? " and picked up the ball" : ""}`;
    // Returning home ends a sprint immediately, including when home is its midpoint.
    if (a.ball && crossed.includes(HOMES[p])) {
      a.pos = HOMES[p];
      a.finished = true;
      detail += " and brought it home";
    }
  }
  next.version++;
  next.turn = 1 - p;
  if (a.finished) {
    if (p === 0) {
      next.finalLap = true;
    } else next.result = next.players[0].finished ? "tie" : 1;
  }
  if (p === 1 && next.finalLap)
    next.result = next.players[1].finished ? "tie" : 0;
  next.last = `${NAMES[p]} ${detail}.`;
  return next;
}
