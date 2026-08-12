(() => {
  "use strict";
  fetch("/api/data", { cache: "no-store" })
    .then(response => { if (!response.ok) throw new Error("API unavailable"); return response.json(); })
    .then(data => { window.RTP_DATA = data; window.dispatchEvent(new CustomEvent("rtp:data-ready")); })
    .catch(() => { window.dispatchEvent(new CustomEvent("rtp:data-ready")); });
})();
