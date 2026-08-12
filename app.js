(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const els = { grid: $("#game-grid"), providers: $("#provider-list"), search: $("#search-input"), sort: $("#sort-select"), summary: $("#result-summary"), load: $("#load-more"), empty: $("#empty-state"), reset: $("#reset-filter"), emptyReset: $("#empty-reset"), modal: $("#game-modal"), backTop: $("#back-top") };
  const state = { provider: "all", query: "", sort: "featured", limit: 30, data: null };
  const imageBase = "https://rtpbp2.bopel.space/images/";
  const esc = value => String(value ?? "").replace(/[&<>'\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const norm = value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  async function loadData() {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      if (!response.ok) throw new Error("API unavailable");
      state.data = await response.json();
    } catch {
      state.data = window.RTP_DATA;
    }
    if (!state.data || !Array.isArray(state.data.games)) {
      $("#app-status")?.replaceChildren(document.createTextNode("Katalog belum tersedia. Muat ulang halaman."));
      return;
    }
    renderProviders(); renderGames(); setup();
  }

  function renderProviders() {
    els.providers.innerHTML = (state.data.providers || []).map(item => {
      const visual = item.logo ? `<img src="${imageBase}providers/${esc(item.logo)}" alt="" width="32" height="32" loading="lazy">` : `<span class="chip-icon">${esc(item.icon || "▦")}</span>`;
      return `<button class="provider-chip${item.id === state.provider ? " is-active" : ""}" type="button" data-provider="${esc(item.id)}" aria-pressed="${item.id === state.provider}">${visual}<span>${esc(item.name)}</span></button>`;
    }).join("");
    $("#provider-total").textContent = Math.max(0, state.data.providers.length - 1).toLocaleString("id-ID");
  }

  function games() {
    let result = state.data.games.filter(game => (state.provider === "all" || game.p === state.provider) && norm(`${game.n} ${game.p}`).includes(norm(state.query.trim())));
    if (state.sort === "rtp-desc") result.sort((a,b) => b.r - a.r);
    if (state.sort === "rtp-asc") result.sort((a,b) => a.r - b.r);
    if (state.sort === "name") result.sort((a,b) => a.n.localeCompare(b.n, "id"));
    return result;
  }

  function card(game, index) {
    const width = Math.max(8, Math.min(100, Number(game.r) || 0));
    const image = game.i?.startsWith("http") ? game.i : `${imageBase}games/${esc(game.i || "")}`;
    return `<article class="game-card"><div class="game-image"><img src="${image}" alt="${esc(game.n)}" loading="lazy" width="280" height="230" onerror="this.style.opacity='.15'">${game.hot ? '<span class="game-badge">PILIHAN</span>' : ""}</div><div class="game-body"><h3 class="game-title" title="${esc(game.n)}">${esc(game.n)}</h3><p class="game-provider">${esc(game.p)}</p><div class="rtp-row"><span>Indikator RTP</span><strong>${Number(game.r).toFixed(1)}%</strong></div><div class="meter"><i style="width:${width}%"></i></div><button class="pattern-button" type="button" data-open-game="${index}">▦ &nbsp; POLA MAIN</button></div></article>`;
  }

  function renderGames() {
    const result = games(), visible = result.slice(0, state.limit);
    els.grid.innerHTML = visible.map(game => card(game, state.data.games.indexOf(game))).join("");
    els.grid.hidden = result.length === 0; els.empty.hidden = result.length !== 0;
    els.summary.textContent = result.length ? `Menampilkan ${visible.length} dari ${result.length} game` : "Tidak ada hasil";
    els.load.hidden = result.length === 0 || visible.length >= result.length;
    els.load.textContent = `+ TAMPILKAN LEBIH BANYAK (${Math.max(0, result.length - visible.length)} tersisa)`;
    els.reset.hidden = state.provider === "all" && !state.query && state.sort === "featured";
    $("#game-total").textContent = state.data.games.length.toLocaleString("id-ID");
    $("#app-status").hidden = true;
  }

  function reset() { state.provider = "all"; state.query = ""; state.sort = "featured"; state.limit = 30; els.search.value = ""; els.sort.value = "featured"; renderProviders(); renderGames(); }
  function openModal(index) {
    const game = state.data.games[index]; if (!game) return;
    const image = game.i?.startsWith("http") ? game.i : `${imageBase}games/${game.i}`;
    $("#modal-image").src = image; $("#modal-image").alt = game.n; $("#modal-title").textContent = game.n; $("#modal-provider").textContent = game.p;
    $("#modal-chip-rtp").textContent = `${Number(game.r).toFixed(1)}%`; $("#modal-rtp").textContent = `${Number(game.r).toFixed(1)}%`; $("#modal-meter").style.width = `${Math.max(0, Math.min(100, game.r))}%`;
    const seed = [...game.n].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    $("#modal-pattern").innerHTML = [{label:"Sesuaikan nilai",spin:`${18 + seed % 17}x Spin Turbo`},{label:"Ulangi dari awal",spin:`${32 + seed % 19}x Spin Cepat`},{label:"Mulai bertahap",spin:`${16 + seed % 13}x Spin Manual`}].map(x => `<li><strong>${esc(x.label)}</strong><span>${esc(x.spin)}</span></li>`).join("");
    els.modal.showModal(); document.body.classList.add("modal-open");
  }
  function closeModal() { if (els.modal?.open) els.modal.close(); document.body.classList.remove("modal-open"); }

  function setupCarousel() {
    const slides = [...document.querySelectorAll(".slide")], dots = $(".carousel-dots"); if (!slides.length || !dots) return;
    let current = 0; dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Tampilkan banner ${i+1}" class="${i ? "" : "is-active"}"></button>`).join("");
    const show = i => { current = (i + slides.length) % slides.length; slides.forEach((s, n) => s.classList.toggle("is-active", n === current)); [...dots.children].forEach((d,n) => d.classList.toggle("is-active", n === current)); };
    $(".carousel .prev")?.addEventListener("click", () => show(current - 1)); $(".carousel .next")?.addEventListener("click", () => show(current + 1)); dots.addEventListener("click", e => { const i = [...dots.children].indexOf(e.target); if (i >= 0) show(i); }); setInterval(() => show(current + 1), 6500);
  }
  function setup() {
    els.providers.addEventListener("click", e => { const b = e.target.closest("[data-provider]"); if (!b) return; state.provider = b.dataset.provider; state.limit = 30; renderProviders(); renderGames(); $("#games")?.scrollIntoView({behavior:"smooth", block:"start"}); });
    els.search.addEventListener("input", e => { state.query = e.target.value; state.limit = 30; renderGames(); });
    els.sort.addEventListener("change", e => { state.sort = e.target.value; state.limit = 30; renderGames(); });
    els.load.addEventListener("click", () => { state.limit += 30; renderGames(); }); els.reset.addEventListener("click", reset); els.emptyReset.addEventListener("click", reset);
    els.grid.addEventListener("click", e => { const b = e.target.closest("[data-open-game]"); if (b) openModal(Number(b.dataset.openGame)); }); $("#modal-close")?.addEventListener("click", closeModal); els.modal?.addEventListener("click", e => { if (e.target === els.modal) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); els.search.focus(); } if (e.key === "Escape") closeModal(); });
    $(".provider-prev")?.addEventListener("click", () => els.providers.scrollBy({left:-360, behavior:"smooth"})); $(".provider-next")?.addEventListener("click", () => els.providers.scrollBy({left:360, behavior:"smooth"}));
    if (els.backTop) { window.addEventListener("scroll", () => els.backTop.classList.toggle("is-visible", scrollY > 600), {passive:true}); els.backTop.addEventListener("click", () => scrollTo({top:0, behavior:"smooth"})); }
    setupCarousel();
  }
  loadData();
})();
