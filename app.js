(() => {
  "use strict";
  const data = window.RTP_DATA;
  const statusEl = document.querySelector("#app-status");
  if (!data || !Array.isArray(data.games) || !Array.isArray(data.providers)) {
    if (statusEl) statusEl.textContent = "Katalog dasar tetap tersedia. Muat ulang halaman untuk mengaktifkan filter.";
    return;
  }
  const $ = (s, root = document) => root.querySelector(s);
  const els = {
    grid: $("#game-grid"), providers: $("#provider-list"), search: $("#search-input"),
    sort: $("#sort-select"), summary: $("#result-summary"), load: $("#load-more"),
    empty: $("#empty-state"), reset: $("#reset-filter"), emptyReset: $("#empty-reset"),
    modal: $("#game-modal"), backTop: $("#back-top")
  };
  const state = { provider: "all", query: "", sort: "featured", limit: 30, slide: 0 };
  const imageBase = "https://rtpbp2.bopel.space/images/";
  const normalize = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);

  function renderProviders() {
    els.providers.innerHTML = data.providers.map(item => {
      const visual = item.logo
        ? `<img src="${imageBase}providers/${item.logo}" alt="" width="32" height="32" loading="lazy">`
        : `<span class="chip-icon" aria-hidden="true">${item.icon}</span>`;
      return `<button class="provider-chip${item.id === state.provider ? " is-active" : ""}" type="button" data-provider="${escapeHTML(item.id)}" aria-pressed="${item.id === state.provider}">${visual}<span>${escapeHTML(item.name)}</span></button>`;
    }).join("");
  }

  function filteredGames() {
    let result = data.games.filter(game => {
      const providerMatch = state.provider === "all" || game.p === state.provider;
      const haystack = normalize(`${game.n} ${game.p}`);
      return providerMatch && haystack.includes(normalize(state.query.trim()));
    });
    if (state.sort === "rtp-desc") result.sort((a,b) => b.r - a.r);
    if (state.sort === "rtp-asc") result.sort((a,b) => a.r - b.r);
    if (state.sort === "name") result.sort((a,b) => a.n.localeCompare(b.n,"id"));
    return result;
  }

  function cardTemplate(game, index) {
    const width = Math.max(8, Math.min(100, game.r));
    return `<article class="game-card" data-game-index="${index}">
      <div class="game-image"><img src="${imageBase}games/${game.i}" alt="${escapeHTML(game.n)}" loading="lazy" width="280" height="230" onerror="this.style.opacity='.15'">${game.hot ? '<span class="game-badge">PILIHAN</span>' : ""}</div>
      <div class="game-body"><h3 class="game-title" title="${escapeHTML(game.n)}">${escapeHTML(game.n)}</h3><p class="game-provider">${escapeHTML(game.p)}</p>
      <div class="rtp-row"><span>Indikator RTP</span><strong>${game.r.toFixed(1)}%</strong></div><div class="meter"><i style="width:${width}%"></i></div>
      <button class="pattern-button" type="button" data-open-game="${index}">▦ &nbsp; POLA MAIN</button></div></article>`;
  }

  function renderGames() {
    const games = filteredGames();
    const visible = games.slice(0, state.limit);
    els.grid.innerHTML = visible.map(game => cardTemplate(game, data.games.indexOf(game))).join("");
    els.summary.textContent = games.length ? `Menampilkan ${visible.length} dari ${games.length} game` : "Tidak ada hasil";
    els.empty.hidden = games.length !== 0;
    els.grid.hidden = games.length === 0;
    els.load.hidden = games.length === 0 || visible.length >= games.length;
    els.load.textContent = `+ TAMPILKAN LEBIH BANYAK (${Math.max(0, games.length - visible.length)} tersisa)`;
    els.reset.hidden = state.provider === "all" && !state.query && state.sort === "featured";
    if (statusEl) statusEl.hidden = true;
  }

  function resetAll() {
    Object.assign(state, {provider:"all", query:"", sort:"featured", limit:30});
    els.search.value = ""; els.sort.value = "featured"; renderProviders(); renderGames();
  }

  function patternFor(game) {
    let seed = [...game.n].reduce((sum,c) => sum + c.charCodeAt(0), 0);
    return [
      {label:"Sesuaikan nilai",spin:`${18 + seed % 17}x Spin Turbo`},
      {label:"Ulangi dari awal",spin:`${32 + seed % 19}x Spin Cepat`},
      {label:"Mulai bertahap",spin:`${16 + seed % 13}x Spin Manual`}
    ];
  }

  function openModal(index) {
    const game = data.games[index]; if (!game) return;
    $("#modal-image").src = `${imageBase}games/${game.i}`; $("#modal-image").alt = game.n;
    $("#modal-provider").textContent = game.p; $("#modal-title").textContent = game.n;
    $("#modal-chip-rtp").textContent = `${game.r.toFixed(1)}%`;
    $("#modal-rtp").textContent = `${game.r.toFixed(1)}%`; $("#modal-meter").style.width = `${game.r}%`;
    $("#modal-pattern").innerHTML = patternFor(game).map(item => `<li><strong>${escapeHTML(item.label)}</strong><span>${escapeHTML(item.spin)}</span></li>`).join("");
    els.modal.showModal(); document.body.classList.add("modal-open");
  }
  function closeModal() { if (els.modal.open) els.modal.close(); document.body.classList.remove("modal-open"); }

  function setupCarousel() {
    const slides = [...document.querySelectorAll(".slide")], dots = $(".carousel-dots");
    dots.innerHTML = slides.map((_,i) => `<button type="button" aria-label="Tampilkan banner ${i+1}" class="${i===0?"is-active":""}"></button>`).join("");
    const show = index => { state.slide = (index + slides.length) % slides.length; slides.forEach((s,i)=>s.classList.toggle("is-active",i===state.slide)); [...dots.children].forEach((d,i)=>d.classList.toggle("is-active",i===state.slide)); };
    $(".carousel .prev").addEventListener("click",()=>show(state.slide-1)); $(".carousel .next").addEventListener("click",()=>show(state.slide+1));
    dots.addEventListener("click",e=>{const i=[...dots.children].indexOf(e.target);if(i>=0)show(i)});
    let timer=setInterval(()=>show(state.slide+1),6500); $(".carousel").addEventListener("mouseenter",()=>clearInterval(timer),{once:true});
  }

  function setupWithdrawToast() {
    const toast=$("#wd-toast"), member=$("#wd-member"), amount=$("#wd-amount"), close=$("#wd-close");
    if(!toast||!member||!amount)return;
    const entries=[["ID: And***","Rp1.500.000"],["ID: Jis***","Rp2.000.000"],["ID: Riz***","Rp850.000"],["ID: Dew***","Rp3.250.000"]];
    let index=0, timer;
    const show=()=>{const row=entries[index++%entries.length];member.textContent=row[0];amount.textContent=row[1];toast.classList.add("is-visible");clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove("is-visible"),5500)};
    setTimeout(show,1600);setInterval(show,11000);close?.addEventListener("click",()=>{toast.classList.remove("is-visible");clearTimeout(timer)});
  }

  function setupSoundToggle(){
    const button=$("#sound-toggle");if(!button)return;
    button.addEventListener("click",()=>{const active=button.getAttribute("aria-pressed")!=="true";button.setAttribute("aria-pressed",String(active));button.textContent=active?"🔈":"🔊";button.setAttribute("aria-label",active?"Matikan suara notifikasi":"Aktifkan suara notifikasi")});
  }

  els.providers.addEventListener("click", e => { const btn=e.target.closest("[data-provider]"); if(!btn)return; state.provider=btn.dataset.provider; state.limit=30; renderProviders(); renderGames(); $("#games").scrollIntoView({behavior:"smooth",block:"start"}); });
  els.search.addEventListener("input", e => { state.query=e.target.value; state.limit=30; renderGames(); });
  els.sort.addEventListener("change", e => { state.sort=e.target.value; state.limit=30; renderGames(); });
  els.load.addEventListener("click",()=>{state.limit+=30;renderGames()}); els.reset.addEventListener("click",resetAll); els.emptyReset.addEventListener("click",resetAll);
  els.grid.addEventListener("click",e=>{const btn=e.target.closest("[data-open-game]");if(btn)openModal(Number(btn.dataset.openGame))});
  $("#modal-close").addEventListener("click",closeModal); els.modal.addEventListener("click",e=>{if(e.target===els.modal)closeModal()});
  document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|select|textarea/i.test(document.activeElement.tagName)){e.preventDefault();els.search.focus()}if(e.key==="Escape")closeModal()});
  $(".provider-prev").addEventListener("click",()=>els.providers.scrollBy({left:-360,behavior:"smooth"})); $(".provider-next").addEventListener("click",()=>els.providers.scrollBy({left:360,behavior:"smooth"}));
  window.addEventListener("scroll",()=>els.backTop.classList.toggle("is-visible",scrollY>600),{passive:true}); els.backTop.addEventListener("click",()=>scrollTo({top:0,behavior:"smooth"}));
  $("#game-total").textContent=data.games.length.toLocaleString("id-ID"); $("#provider-total").textContent=(data.providers.length-1).toLocaleString("id-ID");
  renderProviders(); renderGames(); setupCarousel(); setupWithdrawToast(); setupSoundToggle();
})();
