import { API_ORIGIN } from "./config.mjs";
import {
  NAMES,
  HOMES,
  BALLS,
  ROCKS,
  cellName,
  edge,
  route,
  distance,
  validate,
  legalMoves,
  applyMove,
} from "./engine.mjs";
import { createSound } from "./sound.mjs";
const $ = (id) => document.getElementById(id),
  NS = "olives-fetch-race:v1:";
const read = (k) => {
    try {
      return localStorage.getItem(NS + k);
    } catch {
      return null;
    }
  },
  save = (k, v) => {
    try {
      if (v === null) localStorage.removeItem(NS + k);
      else localStorage.setItem(NS + k, v);
      return true;
    } catch {
      return false;
    }
  };
let key = read("key") || "",
  state = null,
  player = null,
  mode = "step",
  selected = null,
  anchor = null,
  pending = null,
  busy = false,
  polling = false,
  notice = "",
  online = false;
try {
  pending = JSON.parse(read("pending"));
} catch {
  save("pending", null);
}
const sound = createSound({ enabled: read("mute") !== "yes" });
function soundButton() {
  $("sound").textContent = sound.enabled ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound.enabled));
}
soundButton();
for (const type of ["pointerdown", "keydown"])
  document.addEventListener(type, () => sound.unlock(), { capture: true });
$("sound").onclick = () => {
  sound.setEnabled(!sound.enabled);
  save("mute", sound.enabled ? "no" : "yes");
  sound.unlock();
  soundButton();
  if (sound.enabled) sound.play("care");
};
$("ball").onclick = () => {
  $("ball").classList.remove("wiggle");
  void $("ball").offsetWidth;
  $("ball").classList.add("wiggle");
  $("ball-message").textContent = [
    "Olive: “I can carry both. This seems inefficient.”",
    "A tactical pause for one extremely good dog.",
    "Olive has retrieved the spare ball. Again.",
  ][Math.floor(Math.random() * 3)];
  sound.play("ball");
};
$("rules").onclick = () => {
  $("rules-dialog").showModal();
  sound.play("care");
};
$("close-rules").onclick = () => $("rules-dialog").close();
$("routes").onchange = () => render();
function adopt(data) {
  if (!data.state) return;
  player = data.player ?? player;
  if (!state || data.state.version >= state.version) {
    if (state && data.state.version > state.version) {
      selected = null;
      anchor = null;
    }
    state = data.state;
  }
}
async function request(path, move) {
  const response = await fetch(API_ORIGIN + path, {
    method: move ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(move ? { "Content-Type": "application/json" } : {}),
    },
    ...(move ? { body: JSON.stringify(move) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  return { response, data };
}
async function refresh() {
  if (!key || !API_ORIGIN || polling) return;
  polling = true;
  try {
    const { response, data } = await request("/state");
    if (!response.ok) throw Error(data.error || "Could not open this garden.");
    adopt(data);
    online = true;
    if (!pending) notice = "";
  } catch (e) {
    online = false;
    notice = state
      ? "Offline. Your race is safe. Reconnect before confirming."
      : e.message;
  } finally {
    polling = false;
    render();
  }
}
async function send() {
  if (!pending || busy) return;
  busy = true;
  render();
  try {
    const { response, data } = await request("/move", pending);
    adopt(data);
    online = true;
    if (response.ok) {
      if (!data.alreadyApplied)
        sound.play(
          state.result !== null
            ? "win"
            : pending.action.type === "fence"
              ? "couch"
              : "fetch",
        );
      pending = null;
      save("pending", null);
      selected = null;
      anchor = null;
      notice = "Move saved. Your partner can play whenever they’re ready.";
    } else if ([400, 409, 422].includes(response.status)) {
      pending = null;
      save("pending", null);
      selected = null;
      anchor = null;
      notice = data.error;
    } else {
      notice = data.error || "Could not save. Retry your saved move.";
    }
  } catch {
    online = false;
    notice =
      "Connection interrupted. Your exact move is kept safely on this device. Reconnect to retry.";
  } finally {
    busy = false;
    render();
  }
}
$("join-form").onsubmit = async (e) => {
  e.preventDefault();
  const entered = $("key").value.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(entered)) {
    $("setup").textContent = "Enter the full private player key for this game.";
    return;
  }
  if (entered !== key) {
    pending = null;
    save("pending", null);
  }
  key = entered;
  save("key", key);
  $("key").value = "";
  sound.play("care");
  await refresh();
  if (pending && state) await send();
};
$("leave").onclick = () => {
  key = "";
  state = null;
  player = null;
  pending = null;
  selected = null;
  save("key", null);
  save("pending", null);
  notice = "";
  render();
};
$("retry").onclick = async () => {
  sound.unlock();
  if (pending) await send();
  else await refresh();
};
for (const b of document.querySelectorAll("[data-mode]"))
  b.onclick = () => {
    mode = b.dataset.mode;
    selected = null;
    anchor = null;
    notice = "";
    sound.play("care");
    render();
  };
$("commit").onclick = async () => {
  if (
    busy ||
    pending ||
    !online ||
    !selected ||
    validate(state, player, selected)
  )
    return;
  pending = {
    id: crypto.randomUUID(),
    version: state.version,
    kind: "move",
    action: selected,
  };
  if (!save("pending", JSON.stringify(pending))) {
    pending = null;
    notice =
      "Device storage is unavailable. Enable storage before making a move so retries stay safe.";
    render();
    return;
  }
  await send();
};
function tap(n) {
  if (
    !state ||
    state.result !== null ||
    state.turn !== player ||
    busy ||
    pending
  )
    return;
  sound.play("care");
  if (mode === "fence") {
    if (anchor === null || anchor === n) {
      anchor = anchor === n ? null : n;
      selected = null;
    } else {
      const m = { type: "fence", a: anchor, b: n };
      const error = validate(state, player, m);
      if (error) {
        notice = error;
        selected = null;
        anchor = n;
      } else {
        selected = m;
        notice = "";
      }
    }
  } else {
    const m = { type: mode, to: n };
    const error = validate(state, player, m);
    if (error) {
      notice = error;
      selected = null;
    } else {
      selected = m;
      notice = "";
    }
  }
  render();
}
let renderedSignature = "";
function render() {
  // An unchanged poll must not rebuild the board, steal focus, or replay animation.
  const signature = JSON.stringify([
    state,
    player,
    mode,
    selected,
    anchor,
    pending,
    busy,
    notice,
    online,
    $("routes").checked,
  ]);
  if (signature === renderedSignature) return;
  renderedSignature = signature;
  $("join-panel").hidden = !!state;
  $("game").hidden = !state;
  if (!API_ORIGIN) {
    $("setup").textContent =
      "This private garden is in local review. Shared play opens after Mike approves publication.";
    $("join").disabled = true;
  } else if (!state && notice) $("setup").textContent = notice;
  if (!state) return;
  const mine = state.turn === player && state.result === null,
    can = mine && !busy && !pending;
  $("turn-number").textContent = `TURN ${state.version + 1}`;
  $("connection").textContent = busy
    ? "SAVING YOUR MOVE…"
    : pending
      ? "MOVE WAITING TO RECONNECT"
      : online
        ? "SHARED GARDEN · SAVED"
        : "OFFLINE · RECONNECT TO PLAY";
  $("turn-title").textContent =
    state.result === "tie"
      ? "A perfectly matched pair."
      : state.result !== null
        ? `${NAMES[state.result]} wins the race!`
        : mine
          ? `Your turn, ${NAMES[player]}.`
          : `${NAMES[state.turn]} is up next.`;
  $("last").textContent =
    state.last +
    (state.finalLap && state.result === null
      ? " Aimee has one final turn to tie."
      : "");
  for (let p = 0; p < 2; p++) {
    const a = state.players[p];
    $("player" + p).classList.toggle(
      "active",
      state.turn === p && state.result === null,
    );
    $("player" + p).innerHTML =
      `<strong>${NAMES[p]} ${p === player ? "· you" : ""} ${a.ball ? "●" : ""}</strong>${a.finished ? "Home with the ball" : a.ball ? "Bring it home" : "Fetch your ball"}<br>${a.fences} fences · ${a.sprints} sprints · ${distance(state, p)} steps`;
  }
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    b.disabled =
      !can ||
      (b.dataset.mode === "sprint" && !state.players[player].sprints) ||
      (b.dataset.mode === "fence" && !state.players[player].fences);
  }
  $("hint").textContent = pending
    ? "Your saved move is locked until the server confirms it."
    : !mine
      ? "You can study the board while your partner plans."
      : mode === "fence"
        ? anchor === null
          ? "Tap one lawn square, then its neighbor to place a fence."
          : "Tap a neighboring square to preview the fence."
        : `Tap a highlighted square to preview your ${mode === "step" ? "walk" : "sprint"}.`;
  let view = state;
  if (selected && !validate(state, player, selected))
    view = applyMove(state, player, selected);
  let path = [];
  if ($("routes").checked) {
    const a = view.players[player];
    path = route(view, a.pos, a.ball ? HOMES[player] : BALLS[player]) || [];
  }
  const legal = can ? legalMoves(state, player, mode) : [];
  const allowed = new Set(
    mode === "fence"
      ? legal
          .filter((m) => anchor === null || m.a === anchor || m.b === anchor)
          .flatMap((m) => [m.a, m.b])
      : legal.map((m) => m.to),
  );
  const focused = document.activeElement?.dataset?.cell;
  $("board").replaceChildren();
  for (let n = 0; n < 49; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.dataset.cell = n;
    b.classList.toggle("rock", ROCKS.includes(n));
    b.classList.toggle("legal", allowed.has(n));
    b.classList.toggle("path", path.includes(n));
    b.classList.toggle(
      "selected",
      selected?.to === n ||
        selected?.a === n ||
        selected?.b === n ||
        anchor === n,
    );
    let label = cellName(n);
    b.innerHTML = `<span class="coord">${label}</span>`;
    if (ROCKS.includes(n)) {
      b.innerHTML += "✿";
      label += " flower bed";
    } else {
      for (let p = 0; p < 2; p++) {
        if (n === HOMES[p]) {
          b.innerHTML += `<span class="goal p${p}">⌂</span>`;
          label += ` ${NAMES[p]}’s home`;
        }
        if (n === BALLS[p] && !state.players[p].ball) {
          b.innerHTML += `<span class="goal p${p}">●</span>`;
          label += ` ${NAMES[p]}’s ball`;
        }
        if (state.players[p].pos === n) {
          b.innerHTML += `<span class="token p${p}">${NAMES[p][0]}${state.players[p].ball ? "•" : ""}</span>`;
          label += ` ${NAMES[p]}`;
        }
      }
    }
    if (allowed.has(n)) label += " legal preview";
    b.setAttribute("aria-label", label);
    b.disabled = ROCKS.includes(n) || !can;
    b.onclick = () => tap(n);
    $("board").append(b);
  }
  if (focused !== undefined)
    $("board")
      .querySelector(`[data-cell="${focused}"]`)
      ?.focus({ preventScroll: true });
  const lines = [];
  for (const w of view.walls) {
    const [a, b] = w.split("-").map(Number),
      x = (((a % 7) + (b % 7)) / 2) * 100 + 50,
      y = ((Math.floor(a / 7) + Math.floor(b / 7)) / 2) * 100 + 50;
    const vertical = b - a === 1,
      preview = !state.walls.includes(w);
    lines.push(
      `<line x1="${x - (vertical ? 0 : 37)}" y1="${y - (vertical ? 37 : 0)}" x2="${x + (vertical ? 0 : 37)}" y2="${y + (vertical ? 37 : 0)}" stroke="${preview ? "#bb6b39" : "#6c5140"}" stroke-width="9" stroke-linecap="round" ${preview ? 'stroke-dasharray="12 7"' : ""}/>`,
    );
  }
  $("walls").innerHTML = lines.join("");
  $("preview").textContent =
    selected && !validate(state, player, selected)
      ? `${selected.type === "fence" ? `Fence ${cellName(selected.a)} ↔ ${cellName(selected.b)}. Costs one fence and your turn.` : `${selected.type === "sprint" ? "Sprint" : "Walk"} to ${cellName(selected.to)}.${selected.type === "sprint" ? " Costs one sprint." : ""}`} Walking distance after: Mike ${distance(view, 0)}, Aimee ${distance(view, 1)}.${selected.type === "fence" ? ` Detour: Mike +${distance(view, 0) - distance(state, 0)}, Aimee +${distance(view, 1) - distance(state, 1)}.` : ""}`
      : "Plan on the board, check the result here, then confirm.";
  $("commit").disabled =
    !can || !online || !selected || !!validate(state, player, selected);
  $("commit").textContent = busy
    ? "Saving…"
    : pending
      ? "Move saved on device"
      : "Confirm move";
  $("retry").hidden = online && !pending;
  $("retry").disabled = busy;
  $("notice").textContent = notice;
}
window.addEventListener("online", async () => {
  await refresh();
  if (pending) await send();
});
window.addEventListener("offline", () => {
  online = false;
  render();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refresh().then(() => {
      if (pending) send();
    });
  } else sound.stop();
});
setInterval(() => {
  if (!document.hidden && !busy) refresh();
}, 4000);
render();
if (key && API_ORIGIN)
  refresh().then(() => {
    if (pending && state) send();
  });
