import {normalizeCredential, canonicalPhrase} from "./access.mjs?v=4";
import { API_ORIGIN } from "./config.mjs";
import {
  NAMES,
  boardFor,
  LAYOUTS,
  cellName,
  edge,
  distance,
  validate,
  legalMoves,
  applyMove,
} from "./engine.mjs?v=3";
import { createSound } from "./sound.mjs";
const $ = (id) => document.getElementById(id),
  NS = "olives-fetch-race:v1:";
let storageUnavailable = false;
const read = (k) => {
    try {
      return localStorage.getItem(NS + k);
    } catch {
      storageUnavailable = true;
      return null;
    }
  },
  save = (k, v) => {
    try {
      if (v === null) localStorage.removeItem(NS + k);
      else localStorage.setItem(NS + k, v);
      return true;
    } catch {
      storageUnavailable = true;
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
  signingIn = false,
  authGeneration = 0,
  refreshController = null,
  notice = "",
  online = false,
  connectionError = null;
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
async function request(path, move, credential = key, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  externalSignal?.addEventListener("abort", abort, {once:true});
  try {
  const response = await fetch(API_ORIGIN + path, {
    method: move ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${credential}`,
      "X-Fetch-Protocol": "3",
      ...(move ? { "Content-Type": "application/json" } : {}),
    },
    ...(move ? { body: JSON.stringify(move) } : {}),
    cache: "no-store",
    signal: controller.signal,
  });
  let data;
  try { data = await response.json(); } catch { throw Error("The garden returned an unreadable response. Please try again."); }
  return { response, data };
  } finally { clearTimeout(timer); externalSignal?.removeEventListener("abort", abort); }
}
async function refresh(force = false) {
  if (!key || !API_ORIGIN || (polling && !force) || (signingIn && !force)) return false;
  if(force) refreshController?.abort();
  const generation = ++authGeneration, credential = key;
  const controller = refreshController = new AbortController();
  polling = true;
  try {
    const { response, data } = await request("/state", undefined, credential, controller.signal);
    if (generation !== authGeneration) return false;
    if (!response.ok) {
      const error = Error(data.error || "Could not open this garden.");
      error.status = response.status;
      throw error;
    }
    if (!data.state || ![0,1].includes(data.player)) throw Error("The garden response was incomplete. Please try again.");
    adopt(data);
    online = true;
    connectionError = null;
    if (!pending) notice = "";
    return true;
  } catch (e) {
    if (generation !== authGeneration) return false;
    online = false;
    connectionError = e.status ?? null;
    if(e.status === 401) {
      state = null;
      player = null;
      selected = null;
      anchor = null;
    }
    notice = e.status ? e.message : state
      ? "Offline. Your race is safe. Reconnect before confirming."
      : e.name === "AbortError" ? "The garden took too long to respond. Your entry is still here. Try Enter garden again."
      : e.message === "Failed to fetch" || e instanceof TypeError ? "Could not connect to the garden. Your entry is still here. Check your connection and try again." : e.message;
    return false;
  } finally {
    if(generation === authGeneration) { polling = false; refreshController = null; render(); }
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
          pending.kind === "rematch"
            ? "care"
            : state.result !== null
            ? "win"
            : pending.action.type === "fence"
              ? "couch"
              : "fetch",
        );
      const wasRematch = pending.kind === "rematch";
      pending = null;
      save("pending", null);
      selected = null;
      anchor = null;
      notice = wasRematch ? "New-race choice saved." : "Move saved. Your partner can play whenever they’re ready.";
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
      "Connection interrupted. Your exact choice is kept safely on this device. Reconnect to retry.";
  } finally {
    busy = false;
    render();
  }
}
$("hide-key").onchange = () => { $("key").type = $("hide-key").checked ? "password" : "text"; };
$("join-form").onsubmit = async (e) => {
  e.preventDefault();
  if(signingIn) return;
  const entered = normalizeCredential($("key").value);
  if (!entered) {
    notice = "Enter your existing player key, or your configured phrase of six or more words.";
    render();
    return;
  }
  signingIn = true;
  notice = "Opening your garden…";
  if (entered !== key) {
    state = null; player = null; pending = null;
    save("pending", null);
  }
  key = entered;
  render();
  try {
    sound.play("care");
    const opened = await refresh(true);
    if(opened) {
      const remembered = save("key", key);
      $("key").value = "";
      if(!remembered) notice = "Signed in for this visit. This browser cannot remember your key or safely save moves; enable browser storage to play.";
      if (pending && state) await send();
    }
  } catch {
    notice = "Could not open the garden. Your entry is still here. Please try again.";
  } finally { signingIn = false; render(); }
};
let changingAccess = false;
$("access-dialog").addEventListener("cancel", event => { if(changingAccess) event.preventDefault(); });
$("access-open").onclick = () => {
  $("access-status").textContent = "Only your final Save changes your own access. Your race and partner’s access stay as they are.";
  for(const id of ["access-current","access-new","access-confirm"]) $(id).value = "";
  $("access-dialog").showModal();
};
$("access-close").onclick = () => { if(!changingAccess) $("access-dialog").close(); };
$("access-form").onsubmit = async event => {
  event.preventDefault();
  if(changingAccess) return;
  const current = normalizeCredential($("access-current").value);
  const phrase = canonicalPhrase($("access-new").value);
  const confirmation = canonicalPhrase($("access-confirm").value);
  if(!current || !phrase || confirmation !== phrase) {
    $("access-status").textContent = "Enter your current key or phrase, then enter and confirm six to twelve different words for your new phrase.";
    return;
  }
  changingAccess = true;
  $("access-save").disabled = true;
  $("access-close").disabled = true;
  $("access-status").textContent = "Saving your access phrase…";
  const expectedPlayer = player;
  const change = {id:crypto.randomUUID(),phrase,confirmation};
  try {
    // Confirm the manually entered credential belongs to this signed-in player.
    const check = await request("/state", undefined, current);
    if(!check.response.ok || check.data.player !== expectedPlayer) throw Error("The current key or phrase does not match your signed-in player. Nothing changed.");
    let result;
    try { result = await request("/access",change,current); }
    catch {
      // A lost reply must not encourage blind rotation: verify the proposed phrase.
      const verify = await request("/state",undefined,phrase);
      if(!verify.response.ok || verify.data.player !== expectedPlayer) throw Error("Could not confirm the change. Keep both entries, reconnect, and try signing in with the new phrase first. If it fails, the old key still applies.");
      result = {response:{ok:true},data:{changed:true}};
    }
    if(!result.response.ok || !result.data.changed) throw Error(result.data.error || "Access could not be changed. Your entries are still here.");
    authGeneration++;refreshController?.abort();polling=false;
    key=phrase;
    const remembered=save("key",key);
    $("access-current").value="";
    $("access-status").textContent = remembered
      ? "Saved. Your new phrase now opens your garden; the previous key no longer does. Save these words privately before closing."
      : "Saved. Your new phrase now opens the garden. This browser cannot remember it; save these words privately before closing.";
    await refresh(true);
  } catch(error) { $("access-status").textContent = error.message || "Could not save access. Your entries are still here."; }
  finally { changingAccess=false;$("access-save").disabled=false;$("access-close").disabled=false; }
};
$("leave").onclick = () => {
  authGeneration++; refreshController?.abort(); polling = false;
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
    race: state.race ?? 0,
    action: selected,
  };
  await persistAndSend();
};
async function persistAndSend() {
  if (!save("pending", JSON.stringify(pending))) {
    pending = null;
    notice = "Device storage is unavailable. Enable storage before saving a choice so retries stay safe.";
    render();
    return;
  }
  await send();
}
let rematchIntent = null;
function reviewRematch(type) {
  if (!state || busy || pending || !online) return;
  rematchIntent = {
    id: crypto.randomUUID(), version: state.version, race: state.race ?? 0,
    kind: "rematch", action: { type, ...(state.rematch ? { proposal: state.rematch.id } : {}) },
  };
  const name = state.rematch ? LAYOUTS[state.rematch.layout].name : "a fresh crossroads garden";
  $("rematch-confirm-title").textContent = type === "request" ? "Invite a fresh race?" : type === "accept" ? "Start the next race together?" : "Keep this race?";
  $("rematch-confirm-copy").textContent = type === "request"
    ? `Invite a new race with a randomly chosen, tested crossroads garden and 14 starting fences. ${NAMES[1 - (state.starter ?? 0)]} will go first. Both will see its name before acceptance. This race stays in place until your partner accepts. Playing a move cancels the invitation.`
    : type === "accept" ? `You both agree to end this race and start ${name} with fresh fences and sprints. The previous race is preserved in storage.`
    : "The invitation will close. This race and its turn stay as they are.";
  $("rematch-confirm").textContent = type === "request" ? "Send invitation" : type === "accept" ? "Accept & start race" : "Keep current race";
  $("rematch-dialog").showModal();
}
$("new-race").onclick = () => reviewRematch("request");
$("accept-race").onclick = () => reviewRematch("accept");
$("decline-race").onclick = () => reviewRematch("decline");
$("rematch-back").onclick = () => $("rematch-dialog").close();
$("rematch-confirm").onclick = async () => {
  if (busy || pending || !online || !rematchIntent) return;
  pending = rematchIntent;
  rematchIntent = null;
  $("rematch-dialog").close();
  await persistAndSend();
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
// Original vector markers: rubber fetch balls with contrasting raised channels.
// Initials and full accessible cell names identify each owner without color.
function ballArt(p) {
  return `<svg class="fetch-ball p${p}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <circle class="ball-outline" cx="24" cy="24" r="21" />
    <circle class="ball-rubber" cx="24" cy="24" r="19" />
    <path class="ball-channel" d="M10 10C26 14 28 34 38 38M38 10C22 14 20 34 10 38" />
    <path class="ball-shine" d="M13 13Q17 8 24 8" />
    <circle class="ball-badge" cx="24" cy="24" r="8" />
    <text class="ball-initial" x="24" y="28">${NAMES[p][0]}</text>
  </svg>`;
}
function houseArt(p) {
  return `<svg class="home-art" viewBox="0 0 48 46" aria-hidden="true" focusable="false">
    <path class="home-chimney" d="M33 6H39V20H33Z" />
    <path class="home-walls" d="M10 20H38V42H10Z" />
    <path class="home-roof" d="M4 22L24 4L44 22L40 26L24 12L8 26Z" />
    <path class="home-door" d="M19 26Q24 23 29 26V42H19Z" />
    <path class="home-window" d="M13 25H17V30H13ZM31 25H35V30H31Z" />
    <text class="home-initial" x="24" y="37">${NAMES[p][0]}</text>
  </svg>`;
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
    connectionError,
    signingIn,
    storageUnavailable,
    key,
  ]);
  if (signature === renderedSignature) return;
  renderedSignature = signature;
  $("join").disabled = signingIn || !API_ORIGIN;
  $("join").textContent = signingIn ? "Opening…" : "Enter garden";
  $("join-form").setAttribute("aria-busy", String(signingIn));
  $("join-panel").hidden = !!state;
  $("game").hidden = !state;
  if (!API_ORIGIN) {
    $("setup").textContent =
      "This private garden is in local review. Shared play opens after Mike approves publication.";
    $("join").disabled = true;
  } else if (!state) $("setup").textContent = notice || "Enter your Fetch Race player key or configured access phrase. Turns wait for you, even for hours.";
  if (!state) return;
  const board = boardFor(state);
  $("layout-label").textContent =
    `${board.name} · ${board.fixedWalls.length} garden fences`;
  $("layout-note").textContent =
    board.courtyard
      ? "Both fetch routes must cross D4 in the shared courtyard. Find your own way in and out. Fourteen garden fences create detours; your six fences are extra."
      : board.id !== "classic-v1"
      ? "Your ball is across the garden. Choose the north, middle, or south crossing. Garden fences are fixed; your six fences are extra."
      : "This race keeps its original garden. Garden fences are fixed; your six fences are extra.";
  const mine = state.turn === player && state.result === null,
    can = mine && !busy && !pending;
  $("turn-number").textContent = `TURN ${(state.ply ?? state.version) + 1}`;
  const invite = state.rematch;
  $("race-label").textContent = `RACE ${(state.race ?? 0) + 1} · FRESH GARDENS AHEAD`;
  $("rematch-status").textContent = invite
    ? `${NAMES[invite.by]} invited a new race in ${LAYOUTS[invite.layout].name}. ${invite.by === player ? "Waiting for your partner." : "Accept only when you are ready to end this race."} Playing a move cancels the invitation.`
    : "The next race gets a different, randomly chosen crossroads garden. Both players agree before it starts.";
  $("new-race").hidden = !!invite;
  $("accept-race").hidden = !invite || invite.by === player;
  $("decline-race").hidden = !invite;
  $("decline-race").textContent = invite?.by === player ? "Withdraw invitation" : "Keep this race";
  for (const id of ["new-race", "accept-race", "decline-race"]) $(id).disabled = busy || !!pending || !online;
  $("connection").textContent = busy
    ? "SAVING…"
    : pending
      ? "CHOICE WAITING TO RECONNECT"
      : online
        ? `SIGNED IN AS ${NAMES[player].toUpperCase()} · SAVED`
        : connectionError === 426
          ? "REFRESH THIS PAGE"
          : connectionError
            ? "CONNECTION NEEDS ATTENTION"
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
      ? ` ${NAMES[1 - (state.starter ?? 0)]} has one final turn to tie.`
      : "");
  for (let p = 0; p < 2; p++) {
    const a = state.players[p];
    $("player" + p).classList.toggle(
      "active",
      state.turn === p && state.result === null,
    );
    $("player" + p).innerHTML =
      `<strong>${NAMES[p]} ${p === player ? "· you" : ""} ${a.ball ? "●" : ""}</strong>${a.finished ? "Home with the ball" : a.ball ? "Bring it home" : "Fetch your ball"}<br>${a.fences} fences to place · ${a.sprints} sprints · ${distance(state, p)} steps`;
  }
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    b.disabled =
      !can ||
      (b.dataset.mode === "sprint" && !state.players[player].sprints) ||
      (b.dataset.mode === "fence" && !state.players[player].fences);
  }
  $("hint").textContent = pending
    ? "Your saved choice is locked until the server confirms it."
    : !mine
      ? state.result === null
        ? `You’re signed in as ${NAMES[player]}. It’s ${NAMES[state.turn]}’s turn; you can study the board while they plan.`
        : "This race is complete. You can invite a fresh race when you’re ready."
      : mode === "fence"
        ? anchor === null
          ? "Tap one lawn square, then its neighbor to place a fence."
          : "Tap a neighboring square to preview the fence."
        : `Tap a highlighted square to preview your ${mode === "step" ? "walk" : "sprint"}.`;
  let view = state;
  if (selected && !validate(state, player, selected))
    view = applyMove(state, player, selected);
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
    b.classList.toggle("rock", board.rocks.includes(n));
    b.classList.toggle("courtyard", board.courtyard?.includes(n) ?? false);
    b.classList.toggle("legal", allowed.has(n));
    b.classList.toggle(
      "selected",
      selected?.to === n ||
        selected?.a === n ||
        selected?.b === n ||
        anchor === n,
    );
    let label = cellName(n);
    b.innerHTML = `<span class="coord">${label}</span>`;
    if (board.rocks.includes(n)) {
      b.innerHTML += "✿";
      label += " flower bed";
    } else {
      if (board.courtyard?.includes(n)) {
        label += " shared courtyard";
        if (n === 24) b.innerHTML += '<span class="crossroads-mark" aria-hidden="true">✦</span>';
      }
      for (let p = 0; p < 2; p++) {
        if (n === board.homes[p]) {
          b.classList.add("has-goal");
          b.innerHTML += `<span class="goal goal-home p${p}" aria-hidden="true">${houseArt(p)}<span class="goal-owner">${NAMES[p]}</span></span>`;
          label += ` ${NAMES[p]}’s home`;
        }
        if (n === board.balls[p] && !state.players[p].ball) {
          b.classList.add("has-goal");
          b.innerHTML += `<span class="goal goal-ball p${p}" aria-hidden="true">${ballArt(p)}</span>`;
          label += ` ${NAMES[p]}’s ball`;
        }
        if (state.players[p].pos === n) {
          b.innerHTML += `<span class="token p${p}" aria-hidden="true">${NAMES[p][0]}${state.players[p].ball ? `<span class="carried-ball">${ballArt(p)}</span>` : ""}</span>`;
          label += ` ${NAMES[p]}${state.players[p].ball ? " carrying their ball" : ""}`;
        }
      }
    }
    if (allowed.has(n)) label += " legal preview";
    b.setAttribute("aria-label", label);
    b.disabled = board.rocks.includes(n) || !can;
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
      preview = !state.walls.includes(w),
      fixed = board.fixedWalls.includes(w);
    lines.push(
      `<line x1="${x - (vertical ? 0 : 37)}" y1="${y - (vertical ? 37 : 0)}" x2="${x + (vertical ? 0 : 37)}" y2="${y + (vertical ? 37 : 0)}" stroke="${preview ? "#bb6b39" : fixed ? "#476b5b" : "#9b6040"}" stroke-width="9" stroke-linecap="round" ${preview ? 'stroke-dasharray="12 7"' : ""}/>`,
    );
    if (fixed) {
      // Fixed garden fences have capped posts; placed fences are a single brown rail.
      for (const end of [-37, 37]) {
        const px = x + (vertical ? 0 : end),
          py = y + (vertical ? end : 0);
        lines.push(
          `<rect x="${px - 6}" y="${py - 6}" width="12" height="12" rx="2" fill="#234c3e" />`,
        );
      }
    }
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
  $("notice").textContent = notice || (storageUnavailable ? "This browser cannot remember your key or safely save moves. Enable browser storage to play." : "");
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
  if (!document.hidden && !busy && state) refresh();
}, 4000);
window.addEventListener("pageshow", event => { if(event.persisted) refresh(); });
document.documentElement.dataset.fetchReady = "yes";
render();
if (key && API_ORIGIN)
  refresh().then(() => {
    if (pending && state) send();
  });
