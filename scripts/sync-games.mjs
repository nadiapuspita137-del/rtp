import { writeFile } from "node:fs/promises";

const SOURCE = (process.env.RTP_SOURCE || "https://rtpbp2.bopel.space").replace(/\/$/, "");

async function readJson(path) {
  const response = await fetch(`${SOURCE}/${path}`, {
    headers: { "user-agent": "rtp-catalog-sync/1.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function fallbackRtp(name, provider) {
  return Number((85 + (hash(`${provider}|${name}`) % 120) / 10).toFixed(1));
}

function imageFile(value) {
  try {
    const url = new URL(String(value || ""), `${SOURCE}/`);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
}

const manifest = await readJson("data/providers.json");
const sourceProviders = (Array.isArray(manifest) ? manifest : manifest.providers)
  .filter(provider => provider && provider.enabled !== false && provider.dataFile);

const results = await Promise.allSettled(sourceProviders.map(async provider => ({
  provider,
  games: await readJson(`data/${provider.dataFile}`)
})));

const providers = [{ id: "all", name: "Slot Favorite", icon: "▦" }];
const games = [];
const failures = [];

for (const result of results) {
  if (result.status === "rejected") {
    failures.push(String(result.reason));
    continue;
  }

  const { provider, games: providerGames } = result.value;
  providers.push({
    id: provider.name,
    name: provider.name,
    logo: provider.logo || ""
  });

  if (!Array.isArray(providerGames)) {
    failures.push(`${provider.dataFile}: format bukan array`);
    continue;
  }

  for (const game of providerGames) {
    const name = String(game?.name || "").trim();
    const image = imageFile(game?.imageUrl || game?.image || "");
    if (!name || !image) continue;
    const configuredRtp = Number(game?.rtp);
    games.push({
      n: name,
      p: provider.name,
      r: Number.isFinite(configuredRtp) && configuredRtp >= 0 && configuredRtp <= 100
        ? Number(configuredRtp.toFixed(1))
        : fallbackRtp(name, provider.name),
      i: image,
      hot: game?.pinned === true
    });
  }
}

if (games.length < 1000) {
  throw new Error(`Sinkronisasi dihentikan: hanya ${games.length} game terbaca. ${failures.join(" | ")}`);
}

const payload = {
  accessUrl: "https://shortq.net/bolapelangi2",
  sourceUpdatedAt: manifest.updatedAt || new Date().toISOString(),
  providers,
  games
};

await writeFile("data.js", `window.RTP_DATA = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`Sinkron selesai: ${games.length} game dari ${providers.length - 1} provider.`);
if (failures.length) console.warn(`Provider gagal: ${failures.join(" | ")}`);
