const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });

const corsHeaders = { "Cache-Control": "no-store" };

function getPath(request) {
  return new URL(request.url).pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
}

function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  const part = header.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function validSession(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = cookieValue(request, "admin_session");
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(payload, env.SESSION_SECRET || env.ADMIN_PASSWORD);
  if (signature !== expected) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return data.role === "admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

async function requireAdmin(request, env) {
  if (!(await validSession(request, env))) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
}

async function ensureSchema(env) {
  if (!env.DB) throw new Error("D1 binding DB belum dikonfigurasi.");
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo TEXT, icon TEXT, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, provider_id TEXT NOT NULL, rtp REAL NOT NULL DEFAULT 0, image TEXT, hot INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ]);
}

async function seedIfEmpty(request, env) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM games").first();
  if (Number(row?.count || 0) > 0) return;

  const assetUrl = new URL("/data.js", request.url);
  const assetResponse = await fetch(assetUrl);
  if (!assetResponse.ok) throw new Error("data.js tidak dapat dibaca untuk seed awal.");
  const source = await assetResponse.text();
  const marker = "window.RTP_DATA = ";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Format data.js tidak dikenali.");
  const raw = source.slice(start + marker.length).replace(/;\s*$/, "").trim();
  const data = JSON.parse(raw);
  const now = new Date().toISOString();
  const providerStatements = (data.providers || []).map((p, index) => env.DB.prepare("INSERT OR IGNORE INTO providers (id,name,logo,icon,active,sort_order) VALUES (?,?,?,?,1,?)").bind(String(p.id), String(p.name), p.logo || null, p.icon || null, index));
  const gameStatements = (data.games || []).map((g, index) => env.DB.prepare("INSERT OR IGNORE INTO games (id,name,provider_id,rtp,image,hot,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), String(g.n), String(g.p), Number(g.r) || 0, g.i || null, g.hot ? 1 : 0, 1, index, now, now));
  for (let i = 0; i < providerStatements.length; i += 50) await env.DB.batch(providerStatements.slice(i, i + 50));
  for (let i = 0; i < gameStatements.length; i += 50) await env.DB.batch(gameStatements.slice(i, i + 50));
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").bind("accessUrl", data.accessUrl || "").run();
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").bind("sourceUpdatedAt", data.sourceUpdatedAt || now).run();
}

async function getData(env) {
  const providers = await env.DB.prepare("SELECT id,name,logo,icon,active,sort_order FROM providers WHERE active=1 ORDER BY sort_order,id").all();
  const games = await env.DB.prepare("SELECT id,name,provider_id,rtp,image,hot,active,sort_order FROM games WHERE active=1 ORDER BY sort_order,id").all();
  const settingsRows = await env.DB.prepare("SELECT key,value FROM settings").all();
  const settings = Object.fromEntries((settingsRows.results || []).map(row => [row.key, row.value]));
  return {
    accessUrl: settings.accessUrl || "",
    sourceUpdatedAt: settings.sourceUpdatedAt || null,
    providers: [{ id: "all", name: "Slot Favorite", icon: "▦" }, ...(providers.results || []).map(p => ({ id: p.id, name: p.name, logo: p.logo, icon: p.icon }))],
    games: (games.results || []).map(g => ({ id: g.id, n: g.name, p: g.provider_id, r: Number(g.rtp), i: g.image, hot: Boolean(g.hot) }))
  };
}

function id() { return crypto.randomUUID(); }

export async function onRequest(context) {
  const { request, env } = context;
  const path = getPath(request);
  try {
    if (path === "auth/login" && request.method === "POST") {
      const body = await request.json();
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) return json({ error: "Password salah" }, 401, corsHeaders);
      const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ role: "admin", exp: Date.now() + 8 * 60 * 60 * 1000 })));
      const signature = await sign(payload, env.SESSION_SECRET || env.ADMIN_PASSWORD);
      const headers = { "Set-Cookie": `admin_session=${encodeURIComponent(`${payload}.${signature}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`, ...corsHeaders };
      return json({ ok: true }, 200, headers);
    }
    if (path === "auth/logout" && request.method === "POST") return json({ ok: true }, 200, { "Set-Cookie": "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0", ...corsHeaders });
    if (path === "auth/me" && request.method === "GET") return json({ authenticated: await validSession(request, env) }, 200, corsHeaders);

    if (path === "data" && request.method === "GET") {
      await seedIfEmpty(request, env);
      return json(await getData(env), 200, { ...corsHeaders, "Cache-Control": "no-store" });
    }

    await requireAdmin(request, env);
    await ensureSchema(env);

    if (path === "games" && request.method === "GET") {
      const result = await env.DB.prepare("SELECT * FROM games ORDER BY sort_order,id").all();
      return json(result.results || [], 200, corsHeaders);
    }
    if (path === "games" && request.method === "POST") {
      const b = await request.json();
      if (!b.name || !b.provider_id) return json({ error: "Nama dan provider wajib diisi" }, 400);
      const now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO games (id,name,provider_id,rtp,image,hot,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id(), b.name.trim(), b.provider_id, Number(b.rtp) || 0, b.image || "", b.hot ? 1 : 0, b.active === false ? 0 : 1, Number(b.sort_order) || 0, now, now).run();
      return json({ ok: true }, 201, corsHeaders);
    }
    const gameMatch = path.match(/^games\/([^/]+)$/);
    if (gameMatch) {
      const gameId = decodeURIComponent(gameMatch[1]);
      if (request.method === "PUT") {
        const b = await request.json();
        await env.DB.prepare("UPDATE games SET name=?,provider_id=?,rtp=?,image=?,hot=?,active=?,sort_order=?,updated_at=? WHERE id=?").bind(String(b.name).trim(), b.provider_id, Number(b.rtp) || 0, b.image || "", b.hot ? 1 : 0, b.active === false ? 0 : 1, Number(b.sort_order) || 0, new Date().toISOString(), gameId).run();
        return json({ ok: true }, 200, corsHeaders);
      }
      if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM games WHERE id=?").bind(gameId).run();
        return json({ ok: true }, 200, corsHeaders);
      }
    }

    if (path === "providers" && request.method === "GET") {
      const result = await env.DB.prepare("SELECT * FROM providers ORDER BY sort_order,id").all();
      return json(result.results || [], 200, corsHeaders);
    }
    if (path === "providers" && request.method === "POST") {
      const b = await request.json();
      const providerId = (b.id || b.name || "provider").trim().replace(/\s+/g, "-");
      await env.DB.prepare("INSERT INTO providers (id,name,logo,icon,active,sort_order) VALUES (?,?,?,?,?,?)").bind(providerId, b.name.trim(), b.logo || null, b.icon || null, b.active === false ? 0 : 1, Number(b.sort_order) || 0).run();
      return json({ ok: true, id: providerId }, 201, corsHeaders);
    }
    const providerMatch = path.match(/^providers\/([^/]+)$/);
    if (providerMatch) {
      const providerId = decodeURIComponent(providerMatch[1]);
      if (request.method === "PUT") {
        const b = await request.json();
        await env.DB.prepare("UPDATE providers SET name=?,logo=?,icon=?,active=?,sort_order=? WHERE id=?").bind(b.name.trim(), b.logo || null, b.icon || null, b.active === false ? 0 : 1, Number(b.sort_order) || 0, providerId).run();
        return json({ ok: true }, 200, corsHeaders);
      }
      if (request.method === "DELETE") {
        const used = await env.DB.prepare("SELECT COUNT(*) AS count FROM games WHERE provider_id=?").bind(providerId).first();
        if (Number(used?.count || 0) > 0) return json({ error: "Provider masih dipakai oleh game." }, 409, corsHeaders);
        await env.DB.prepare("DELETE FROM providers WHERE id=?").bind(providerId).run();
        return json({ ok: true }, 200, corsHeaders);
      }
    }

    if (path === "settings" && request.method === "GET") {
      const rows = await env.DB.prepare("SELECT key,value FROM settings").all();
      return json(Object.fromEntries((rows.results || []).map(r => [r.key, r.value])), 200, corsHeaders);
    }
    if (path === "settings" && request.method === "PUT") {
      const b = await request.json();
      for (const [key, value] of Object.entries(b)) await env.DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").bind(key, String(value ?? "")).run();
      return json({ ok: true }, 200, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "Server error" }, 500, corsHeaders);
  }
}
