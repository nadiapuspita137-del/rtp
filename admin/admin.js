(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const state = { games: [], providers: [], settings: {}, editingGame: null, editingProvider: null };
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const toast = message => { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2400); };
  const api = async (path, options = {}) => { const response = await fetch(`/api/${path}`, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request gagal (${response.status})`); return data; };

  async function boot() {
    try {
      const me = await api("auth/me");
      if (me.authenticated) return showApp();
      showLogin();
    } catch { showLogin(); }
  }
  function showLogin() { $("#login-view").hidden = false; $("#app-view").hidden = true; }
  function showApp() { $("#login-view").hidden = true; $("#app-view").hidden = false; loadAll(); }

  $("#login-form").addEventListener("submit", async e => { e.preventDefault(); $("#login-error").hidden = true; try { await api("auth/login", { method: "POST", body: JSON.stringify({ password: $("#login-password").value }) }); showApp(); } catch (error) { $("#login-error").textContent = error.message; $("#login-error").hidden = false; } });
  $("#logout").addEventListener("click", async () => { await api("auth/logout", { method: "POST" }).catch(() => {}); showLogin(); });

  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => { document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active")); document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); button.classList.add("active"); $(`#page-${button.dataset.page}`).classList.add("active"); }));
  $("#quick-add").addEventListener("click", () => { document.querySelector('[data-page="games"]').click(); openGame(); });
  $("#add-game").addEventListener("click", () => openGame());
  $("#add-provider").addEventListener("click", () => openProvider());
  $("#game-search").addEventListener("input", renderGames);
  $("#game-provider-filter").addEventListener("change", renderGames);

  async function loadAll() { try { const [data, games, providers, settings] = await Promise.all([api("data"), api("games"), api("providers"), api("settings")]); state.games = games; state.providers = providers; state.settings = settings; renderStats(); renderProviderOptions(); renderGames(); renderProviders(); fillSettings(); } catch (error) { toast(error.message); } }
  function renderStats() { $("#stat-games").textContent = state.games.length.toLocaleString("id-ID"); $("#stat-providers").textContent = state.providers.length.toLocaleString("id-ID"); $("#stat-active").textContent = state.games.filter(g => g.active).length.toLocaleString("id-ID"); $("#stat-hot").textContent = state.games.filter(g => g.hot).length.toLocaleString("id-ID"); }
  function renderProviderOptions() { const options = state.providers.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(""); $("#game-provider").innerHTML = options; $("#game-provider-filter").innerHTML = `<option value="">Semua provider</option>${options}`; }
  function providerName(id) { return state.providers.find(p => p.id === id)?.name || id; }
  function renderGames() { const q = $("#game-search").value.trim().toLowerCase(); const filter = $("#game-provider-filter").value; const rows = state.games.filter(g => (!filter || g.provider_id === filter) && (!q || `${g.name} ${providerName(g.provider_id)}`.toLowerCase().includes(q))); $("#games-body").innerHTML = rows.map(g => `<tr><td><div class="game-name">${esc(g.name)}</div><small class="muted">${esc(g.image || "Tanpa gambar")}</small></td><td>${esc(providerName(g.provider_id))}</td><td><strong>${Number(g.rtp).toFixed(1)}%</strong></td><td><span class="pill ${g.active ? "" : "off"}">${g.active ? "Aktif" : "Nonaktif"}</span></td><td>${g.hot ? "★" : "-"}</td><td><div class="action-row"><button class="ghost small" data-edit-game="${esc(g.id)}">Edit</button><button class="ghost small danger" data-delete-game="${esc(g.id)}">Hapus</button></div></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Tidak ada game.</td></tr>`; }
  function renderProviders() { $("#providers-body").innerHTML = state.providers.map(p => `<tr><td><strong>${esc(p.name)}</strong></td><td><code>${esc(p.id)}</code></td><td>${esc(p.logo || p.icon || "-")}</td><td><span class="pill ${p.active ? "" : "off"}">${p.active ? "Aktif" : "Nonaktif"}</span></td><td><div class="action-row"><button class="ghost small" data-edit-provider="${esc(p.id)}">Edit</button><button class="ghost small danger" data-delete-provider="${esc(p.id)}">Hapus</button></div></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Belum ada provider.</td></tr>`; }

  $("#games-body").addEventListener("click", async e => { const edit = e.target.closest("[data-edit-game]"); const del = e.target.closest("[data-delete-game]"); if (edit) openGame(state.games.find(g => g.id === edit.dataset.editGame)); if (del) { const game = state.games.find(g => g.id === del.dataset.deleteGame); if (!game || !confirm(`Hapus game “${game.name}”?`)) return; try { await api(`games/${encodeURIComponent(game.id)}`, { method: "DELETE" }); toast("Game dihapus"); await loadAll(); } catch (error) { toast(error.message); } } });
  $("#providers-body").addEventListener("click", async e => { const edit = e.target.closest("[data-edit-provider]"); const del = e.target.closest("[data-delete-provider]"); if (edit) openProvider(state.providers.find(p => p.id === edit.dataset.editProvider)); if (del) { const provider = state.providers.find(p => p.id === del.dataset.deleteProvider); if (!provider || !confirm(`Hapus provider “${provider.name}”?`)) return; try { await api(`providers/${encodeURIComponent(provider.id)}`, { method: "DELETE" }); toast("Provider dihapus"); await loadAll(); } catch (error) { toast(error.message); } } });

  function openGame(game = null) { state.editingGame = game; $("#game-dialog-title").textContent = game ? "Edit Game" : "Tambah Game"; $("#game-id").value = game?.id || ""; $("#game-name").value = game?.name || ""; $("#game-provider").value = game?.provider_id || state.providers[0]?.id || ""; $("#game-rtp").value = game?.rtp ?? ""; $("#game-image").value = game?.image || ""; $("#game-hot").checked = Boolean(game?.hot); $("#game-active").checked = game ? Boolean(game.active) : true; $("#game-order").value = game?.sort_order ?? 0; $("#game-dialog").showModal(); }
  $("#game-form").addEventListener("submit", async e => { if (e.submitter?.value === "cancel") return; e.preventDefault(); const payload = { name: $("#game-name").value, provider_id: $("#game-provider").value, rtp: Number($("#game-rtp").value), image: $("#game-image").value, hot: $("#game-hot").checked, active: $("#game-active").checked, sort_order: Number($("#game-order").value) || 0 }; try { if (state.editingGame) await api(`games/${encodeURIComponent(state.editingGame.id)}`, { method: "PUT", body: JSON.stringify(payload) }); else await api("games", { method: "POST", body: JSON.stringify(payload) }); $("#game-dialog").close(); toast("Game tersimpan"); await loadAll(); } catch (error) { toast(error.message); } });

  function openProvider(provider = null) { state.editingProvider = provider; $("#provider-dialog-title").textContent = provider ? "Edit Provider" : "Tambah Provider"; $("#provider-old-id").value = provider?.id || ""; $("#provider-id").value = provider?.id || ""; $("#provider-name").value = provider?.name || ""; $("#provider-logo").value = provider?.logo || ""; $("#provider-icon").value = provider?.icon || "▦"; $("#provider-order").value = provider?.sort_order ?? 0; $("#provider-active").checked = provider ? Boolean(provider.active) : true; $("#provider-id").disabled = Boolean(provider); $("#provider-dialog").showModal(); }
  $("#provider-form").addEventListener("submit", async e => { if (e.submitter?.value === "cancel") return; e.preventDefault(); const payload = { id: $("#provider-id").value, name: $("#provider-name").value, logo: $("#provider-logo").value, icon: $("#provider-icon").value, active: $("#provider-active").checked, sort_order: Number($("#provider-order").value) || 0 }; try { if (state.editingProvider) await api(`providers/${encodeURIComponent(state.editingProvider.id)}`, { method: "PUT", body: JSON.stringify(payload) }); else await api("providers", { method: "POST", body: JSON.stringify(payload) }); $("#provider-dialog").close(); toast("Provider tersimpan"); await loadAll(); } catch (error) { toast(error.message); } });

  function fillSettings() { $("#setting-accessUrl").value = state.settings.accessUrl || ""; $("#setting-sourceUpdatedAt").value = state.settings.sourceUpdatedAt || ""; }
  $("#settings-form").addEventListener("submit", async e => { e.preventDefault(); try { await api("settings", { method: "PUT", body: JSON.stringify({ accessUrl: $("#setting-accessUrl").value, sourceUpdatedAt: $("#setting-sourceUpdatedAt").value }) }); toast("Pengaturan tersimpan"); $("#settings-status").hidden = false; setTimeout(() => $("#settings-status").hidden = true, 1800); } catch (error) { toast(error.message); } });
  boot();
})();
