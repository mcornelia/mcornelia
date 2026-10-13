import {
  initialState,
  applyMove,
  applyRematch,
  boardFor,
} from "../../play/olives-fetch-race/engine.mjs";

import {AccessAuth} from "./access-auth.mjs";

const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function tokenHash(token) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGIN;
    if (origin && origin !== allowed)
      return json({ error: "This origin is not allowed." }, 403);
    const cors = (response) => {
      const headers = new Headers(response.headers);
      if (origin === allowed)
        headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      return new Response(response.body, { status: response.status, headers });
    };
    if (request.method === "OPTIONS")
      return cors(
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Fetch-Protocol",
            "Access-Control-Max-Age": "600",
          },
        }),
      );
    const url = new URL(request.url), path = url.pathname;
    if (!["/state", "/move", "/archive", "/access"].includes(path))
      return cors(json({ error: "Not found." }, 404));
    if (
      (["/state", "/archive"].includes(path) && request.method !== "GET") ||
      (["/move", "/access"].includes(path) && request.method !== "POST")
    )
      return cors(json({ error: "Method not allowed." }, 405));
    // Fail closed until BOTH distinct keys are provisioned. No public room creation.
    if (
      ![env.FETCH_MIKE_KEY_HASH, env.FETCH_AIMEE_KEY_HASH].every((h) =>
        /^[a-f0-9]{64}$/.test(h || ""),
      ) ||
      env.FETCH_MIKE_KEY_HASH === env.FETCH_AIMEE_KEY_HASH
    )
      return cors(
        json({ error: "The private room is not configured yet." }, 503),
      );
    let body;
    if (["/move", "/access"].includes(path)) {
      if (!request.headers.get("Content-Type")?.startsWith("application/json"))
        return cors(json({ error: "JSON required." }, 415));
      if (Number(request.headers.get("Content-Length")) > 2048)
        return cors(json({ error: "Request too large." }, 413));
      const reader = request.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) {
            await reader.cancel();
            return cors(json({ error: "Request too large." }, 413));
          }
          chunks.push(value);
        }
      try {
        body = JSON.parse(await new Blob(chunks).text());
      } catch {
        return cors(json({ error: "Invalid JSON." }, 400));
      }
    }
    const room = env.FETCH_ROOM.get(
      env.FETCH_ROOM.idFromName("olives-fetch-race-v1"),
    );
    const response = await room.fetch(
      new Request(`https://room${path}${url.search}`, {
        method: request.method,
        headers: { "Authorization": request.headers.get("Authorization") || "", "X-Client-IP": await tokenHash(request.headers.get("CF-Connecting-IP") || "local"), "X-Fetch-Protocol": request.headers.get("X-Fetch-Protocol") || "" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const data = await response.json();
    return cors(json(data, response.status));
  },
};

export class FetchRaceRoom {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.auth = new AccessAuth(this.sql, env);
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, player INTEGER NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL)",
    );
    this.sql.exec("CREATE TABLE IF NOT EXISTS race_archive (race INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    this.sql.exec(
      "INSERT OR IGNORE INTO room VALUES (1, ?)",
      // Only an empty room uses this initializer. Existing SQLite state is never replaced.
      JSON.stringify(initialState(env.INITIAL_LAYOUT || "classic-v1")),
    );
  }
  state() {
    return JSON.parse(
      this.sql.exec("SELECT value FROM room WHERE id=1").one().value,
    );
  }
  async fetch(request) {
    // Serialize authentication and its action so revocation cannot race a move.
    return this.ctx.blockConcurrencyWhile(async () => {
      const token=request.headers.get("Authorization")?.match(/^Bearer ([^\r\n]{1,160})$/)?.[1];
      const auth=await this.auth.authenticate(token,request.headers.get("X-Client-IP"));
      if(auth.error)return json({error:auth.error},auth.status);
      const player=auth.player;
      if(new URL(request.url).pathname === "/access") {
        if(request.headers.get("X-Fetch-Protocol")!=="3")return json({error:"Refresh before changing access."},426);
        let body;try{body=await request.json();}catch{return json({error:"Invalid access change."},400);}
        const result=await this.auth.change(player,body),status=result.status||200;
        delete result.status;return json(result,status);
      }
      const response=await this.gameFetch(request,player);
      return json({...await response.json(),player},response.status);
    });
  }
  async gameFetch(request,player) {
    const protocol = request.headers.get("X-Fetch-Protocol");
    const clientProtocol = ["2", "3"].includes(protocol) ? Number(protocol) : 0;
    const current = this.state();
    // A cached classic client must never render or mutate a new garden.
    if (current.layout && clientProtocol < (boardFor(current).protocol ?? 2))
      return json({ error: "Refresh this page to open the new garden." }, 426);
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/archive") {
        if (protocol !== "3") return json({ error: "Refresh before opening an archive." }, 426);
        const values = url.searchParams.getAll("race");
        if (values.length !== 1 || !/^(0|[1-9][0-9]{0,8})$/.test(values[0]))
          return json({ error: "A valid archived race number is required." }, 400);
        const row = this.sql.exec("SELECT value FROM race_archive WHERE race=?", Number(values[0])).toArray()[0];
        return row ? json({ archivedState: JSON.parse(row.value) }) : json({ error: "Archived race not found." }, 404);
      }
      return json({ state: current });
    }
    if (![0, 1].includes(player)) return json({ error: "Unauthorized." }, 401);
    let move;
    try {
      move = await request.json();
    } catch {
      return json({ error: "Invalid move." }, 400);
    }
    if (
      !move ||
      !/^[a-f0-9-]{36}$/.test(move.id || "") ||
      !Number.isSafeInteger(move.version) ||
      move.version < 0 ||
      !["move", "rematch"].includes(move.kind)
    )
      return json({ error: "Invalid move." }, 400);
    if (move.kind === "rematch" && protocol !== "3")
      return json({ error: "Refresh before inviting a new race." }, 426);
    const payload = JSON.stringify(move.race === undefined
      ? [move.version, move.kind, move.action]
      : [move.version, move.kind, move.action, move.race]);
    // All validation, receipt insertion and state updates share one synchronous transaction.
    // No await occurs between reading a version and committing its successor.
    return this.ctx.storage.transactionSync(() => {
      const state = this.state();
      if (state.layout && clientProtocol < (boardFor(state).protocol ?? 2))
        return json({ error: "Refresh this page to open the new garden." }, 426);
      const receipt = this.sql
        .exec("SELECT * FROM receipts WHERE id=?", move.id)
        .toArray()[0];
      if (receipt) {
        if (receipt.player !== player || receipt.payload !== payload)
          return json(
            { error: "This move ID has already been used.", state },
            409,
          );
        return json({ state, alreadyApplied: true });
      }
      if (move.version !== state.version)
        return json(
          {
            error: "The race has moved on. Review the refreshed board.",
            state,
          },
          409,
        );
      if ((move.kind === "rematch" || move.race !== undefined) && move.race !== (state.race ?? 0))
        return json({ error: "This request belongs to an earlier race.", state }, 409);
      if (move.kind === "move" && player !== state.turn)
        return json({ error: "It is your partner’s turn.", state }, 409);
      let next;
      try {
        next = move.kind === "move"
          ? applyMove(state, player, move.action)
          : applyRematch(state, player, move.action, move.id, crypto.getRandomValues(new Uint32Array(1))[0]);
      } catch (error) {
        return json({ error: error.message, state }, 422);
      }
      if ((next.race ?? 0) !== (state.race ?? 0))
        this.sql.exec("INSERT INTO race_archive VALUES (?, ?)", state.race ?? 0, JSON.stringify(state));
      this.sql.exec("UPDATE room SET value=? WHERE id=1", JSON.stringify(next));
      this.sql.exec(
        "INSERT INTO receipts VALUES (?, ?, ?, ?)",
        move.id,
        player,
        payload,
        next.version,
      );
      // Old retries remain harmless after pruning: their monotonically increasing version is stale.
      this.sql.exec(
        "DELETE FROM receipts WHERE version < ?",
        next.version - 256,
      );
      return json({ state: next, alreadyApplied: false });
    });
  }
}
