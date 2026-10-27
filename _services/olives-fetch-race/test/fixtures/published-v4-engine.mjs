export const SIZE = 7,
  NAMES = ["Mike", "Aimee"],
  HOMES = [44, 46],
  BALLS = [2, 4],
  ROCKS = [16, 18, 24, 30, 32];
export const edge = (a, b) => [a, b].sort((x, y) => x - y).join("-");
// Layout IDs are immutable. States created before layout IDs keep their exact
// original geometry. Never change a published definition to introduce a new board.
const crossingWalls = [[2,3],[3,4],[17,24],[24,31],[44,45],[45,46]];
const crossingBoard = (id, name, detours) => Object.freeze({
  id, name, homes: [43,47], balls: [5,1], rocks: [16,18,30,32],
  crossings: [10,24,38], fixedWalls: [...crossingWalls, ...detours].map(([a,b]) => edge(a,b)),
});
export const V2_LAYOUTS = Object.freeze(["crossing-v2", "north-bend-v2", "south-bend-v2"]);
export const V3_LAYOUTS = Object.freeze(["meadow-crossroads-v3", "north-crossroads-v3", "south-crossroads-v3"]);
export const RACE_LAYOUTS = Object.freeze([
  "meadow-crossroads-v4", "north-crossroads-v3", "south-crossroads-v3",
]);
const mirror = n => Math.floor(n / 7) * 7 + 6 - n % 7;
const crossroadsBoard = (id, name, leftWalls, protocol = 3) => Object.freeze({
  id, name, homes: [43, 47], balls: [5, 1],
  // A visible flower-bed divider makes D4 the shared crossing on EVERY route.
  rocks: [3, 10, 17, 31, 38, 45], crossings: [24], courtyard: [23, 24, 25],
  protocol,
  fixedWalls: [...leftWalls, ...leftWalls.map(pair => pair.map(mirror))]
    .map(([a, b]) => edge(a, b)),
});
export const LAYOUTS = Object.freeze({
  "classic-v1": Object.freeze({
    id: "classic-v1",
    name: "Original Garden",
    homes: HOMES,
    balls: BALLS,
    rocks: ROCKS,
    fixedWalls: [edge(2, 9), edge(4, 11)],
    crossings: [],
  }),
  "crossing-v2": Object.freeze({
    id: "crossing-v2",
    name: "Crossing Garden",
    homes: [43, 47],
    balls: [5, 1],
    rocks: [16, 18, 30, 32],
    crossings: [10, 24, 38],
    fixedWalls: [
      [2, 3],
      [3, 4],
      [14, 21],
      [20, 27],
      [17, 24],
      [24, 31],
      [21, 28],
      [27, 34],
      [44, 45],
      [45, 46],
    ].map(([a, b]) => edge(a, b)),
  }),
  "north-bend-v2": crossingBoard("north-bend-v2", "North Bend", [[8,15],[12,19],[21,28],[27,34]]),
  "south-bend-v2": crossingBoard("south-bend-v2", "South Bend", [[14,21],[20,27],[29,36],[33,40]]),
  "meadow-crossroads-v3": crossroadsBoard("meadow-crossroads-v3", "Meadow Crossroads", [
    [15,22], [8,9], [0,7], [36,37], [29,36], [21,22], [30,37],
  ]),
  // Move A4–B4 / F4–G4 to A2–B2 / F2–G2. Opening courtyard cuts
  // cost four steps rather than eight, while every route still crosses D4.
  "meadow-crossroads-v4": crossroadsBoard("meadow-crossroads-v4", "Meadow Crossroads", [
    [15,22], [8,9], [0,7], [36,37], [29,36], [7,8], [30,37],
  ], 4),
  "north-crossroads-v3": crossroadsBoard("north-crossroads-v3", "North Crossroads", [
    [9,16], [28,35], [35,36], [8,15], [14,21], [2,9], [36,37],
  ]),
  "south-crossroads-v3": crossroadsBoard("south-crossroads-v3", "South Crossroads", [
    [30,37], [7,14], [7,8], [29,36], [21,28], [37,44], [8,9],
  ]),
});
export function boardFor(s) {
  const id = s.layout ?? "classic-v1";
  if (!Object.hasOwn(LAYOUTS, id))
    throw Error("Unknown garden layout. Refresh before playing.");
  return LAYOUTS[id];
}
export const cellName = (n) => `${"ABCDEFG"[n % 7]}${Math.floor(n / 7) + 1}`;
export function initialState(layout = "classic-v1") {
  const board = boardFor({ layout });
  return {
    ...(layout === "classic-v1" ? {} : { layout }),
    schema: 1,
    version: 0,
    turn: 0,
    players: board.homes.map((pos) => ({
      pos,
      ball: false,
      fences: 6,
      sprints: 2,
      finished: false,
    })),
    walls: [...board.fixedWalls],
    result: null,
    finalLap: false,
    last: "The garden is ready. Mike takes the first turn.",
  };
}
export const validCell = (n, s = {}) =>
  Number.isInteger(n) && n >= 0 && n < 49 && !boardFor(s).rocks.includes(n);
export function adjacent(a, b, s = {}) {
  return (
    validCell(a, s) &&
    validCell(b, s) &&
    Math.abs((a % 7) - (b % 7)) +
      Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) ===
      1
  );
}
export function neighbors(s, n) {
  return [n - 7, n + 7, n - 1, n + 1].filter(
    (b) => adjacent(n, b, s) && !s.walls.includes(edge(n, b)),
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
  const { homes, balls } = boardFor(s);
  const a = s.players[p];
  if (a.finished) return 0;
  const first = route(s, a.pos, a.ball ? homes[p] : balls[p]);
  const second = a.ball ? null : route(s, balls[p], homes[p]);
  return first ? first.length - 1 + (second ? second.length - 1 : 0) : Infinity;
}
export function validate(s, p, m) {
  const { homes, balls } = boardFor(s);
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
      adjacent(a.pos, mid, s) &&
      adjacent(mid, m.to, s) &&
      neighbors(s, a.pos).includes(mid) &&
      neighbors(s, mid).includes(m.to)
      ? null
      : "Sprint two clear squares in a straight line.";
  }
  if (!a.fences) return "No fences left.";
  if (!adjacent(m.a, m.b, s))
    return "A fence belongs between two neighboring lawn squares.";
  if (s.walls.includes(edge(m.a, m.b)))
    return "There is already a fence there.";
  const next = { ...s, walls: [...s.walls, edge(m.a, m.b)] };
  for (let i = 0; i < 2; i++) {
    const v = s.players[i];
    if (
      !route(next, v.pos, v.ball ? homes[i] : balls[i]) ||
      !route(next, balls[i], homes[i])
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
  const { homes, balls } = boardFor(s);
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
    const got = !a.ball && crossed.includes(balls[p]);
    if (got) a.ball = true;
    detail = `${m.type === "sprint" ? "sprinted" : "walked"} to ${cellName(m.to)}${got ? " and picked up the ball" : ""}`;
    // Returning home ends a sprint immediately, including when home is its midpoint.
    if (a.ball && crossed.includes(homes[p])) {
      a.pos = homes[p];
      a.finished = true;
      detail += " and brought it home";
    }
  }
  next.version++;
  if (next.ply !== undefined) next.ply++;
  delete next.rematch; // Continuing play cancels a pending restart proposal.
  next.turn = 1 - p;
  if (a.finished) {
    if (p === (s.starter ?? 0)) {
      next.finalLap = true;
    } else next.result = next.players[1 - p].finished ? "tie" : p;
  }
  if (p !== (s.starter ?? 0) && next.finalLap)
    next.result = next.players[p].finished ? "tie" : 1 - p;
  next.last = `${NAMES[p]} ${detail}.`;
  return next;
}

// Retain the published v2 export for cached clients playing their old races.
// New clients use the stored invitation; v2 invitations require a refresh.
export function nextLayout(s) {
  return V2_LAYOUTS[(V2_LAYOUTS.indexOf(s.layout) + 1) % V2_LAYOUTS.length];
}

// Shuffle a tested set on the server. The stored invitation and queue survive
// retries/restarts; no garden is rerolled during a race. Every bag uses all three.
export function gardenQueue(s, seed) {
  const updated = id => id === "meadow-crossroads-v3" ? "meadow-crossroads-v4" : id;
  if (s.gardenQueue?.length) return s.gardenQueue.map(updated);
  const queue = [...RACE_LAYOUTS];
  let word = seed >>> 0;
  for (let i = queue.length - 1; i > 0; i--) {
    word = (Math.imul(word, 1664525) + 1013904223) >>> 0;
    const j = word % (i + 1);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (queue[0] === updated(s.layout)) [queue[0], queue[1]] = [queue[1], queue[0]];
  return queue;
}
export function applyRematch(s, p, action, id, randomWord = 0) {
  if (![0, 1].includes(p)) throw Error("Unknown player.");
  if (!action || !["request", "accept", "decline"].includes(action.type))
    throw Error("Choose request, accept, or decline.");
  const next = structuredClone(s);
  if (action.type === "request") {
    if (s.rematch) throw Error("A new-race invitation is already waiting.");
    const queue = gardenQueue(s, randomWord);
    next.rematch = { id, by: p, layout: queue[0], queue: queue.slice(1) };
  } else {
    if (!s.rematch || action.proposal !== s.rematch.id)
      throw Error("That invitation is no longer active.");
    if (action.type === "decline") delete next.rematch;
    else {
      if (s.rematch.by === p) throw Error("Your partner must accept your invitation.");
      const starter = 1 - (s.starter ?? 0);
      return {
        ...initialState(s.rematch.layout), race: (s.race ?? 0) + 1,
        gardenQueue: s.rematch.queue ?? [],
        version: s.version + 1, ply: 0, starter, turn: starter,
        last: `Both agreed to a new race. ${NAMES[starter]} takes the first turn.`,
      };
    }
  }
  next.version++;
  // Invitations are not moves and never use up anyone's turn.
  next.ply = s.ply ?? s.version;
  return next;
}
