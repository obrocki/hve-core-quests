/* Netscape fallback for the IE-only VBScript above. */
(() => {
  const $ = id => document.getElementById(id);
  let flights = [], selectedFlight = null, selectedSeat = null, online = false;
  const seats = ["12A", "12B", "12C", "14A", "14B", "14C", "15A", "15B", "15C"];
  const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function load() {
    try {
      if (location.protocol === "file:") throw new Error("Offline file mode");
      const response = await fetch("/api/flights", {signal: AbortSignal.timeout(2000)});
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      flights = await response.json(); online = true;
    } catch (error) {
      console.info("Using local training data:", error.message);
      flights = window.EAGLE_MOCK; online = false;
    }
    $("connection").textContent = online ? "● Connected to reservation service" : "● Local training mode";
    renderFlights();
    $("splash").hidden = true;
  }
  function renderFlights() {
    const from = $("origin").value, to = $("destination").value;
    $("flights").innerHTML = flights.filter(f => (from === "All airports" || f.origin === from) && (to === "All airports" || f.destination === to))
      .map(f => `<tr data-id="${f.id}" class="${selectedFlight?.id === f.id ? "selected" : ""}"><td>${escapeHtml(f.number)}</td><td>${escapeHtml(f.origin)}</td><td>${escapeHtml(f.destination)}</td><td>${escapeHtml(f.departure)}</td><td>${escapeHtml(f.status)}</td><td>$${escapeHtml(f.fare)}</td></tr>`).join("");
    document.querySelectorAll("#flights tr").forEach(row => row.addEventListener("click", () => selectFlight(Number(row.dataset.id))));
  }
  function selectFlight(id) {
    selectedFlight = flights.find(f => f.id === id); selectedSeat = null; renderFlights();
    $("flight-detail").innerHTML = `<strong>${escapeHtml(selectedFlight.number)}</strong><p>${escapeHtml(selectedFlight.origin)} → ${escapeHtml(selectedFlight.destination)}</p><p>Departure: ${escapeHtml(selectedFlight.departure)}</p><p>Fare from $${escapeHtml(selectedFlight.fare)}</p>`;
    renderSeats(); $("status").textContent = `Flight ${selectedFlight.number} selected`;
  }
  function renderSeats() {
    $("seats").innerHTML = seats.map(seat => `<button data-seat="${seat}" class="${selectedSeat === seat ? "selected" : ""}">${seat}</button>`).join("");
    document.querySelectorAll("#seats button").forEach(button => button.addEventListener("click", () => { selectedSeat = button.dataset.seat; renderSeats(); }));
  }
  $("search").addEventListener("click", renderFlights);
  $("refresh").addEventListener("click", load);
  $("new-booking").addEventListener("click", () => { $("passenger").value = ""; $("passenger").focus(); });
  $("hold").addEventListener("click", async () => {
    if (!selectedFlight || !selectedSeat || !$("passenger").value.trim()) { $("hold-result").textContent = "Select a flight, seat and passenger name."; return; }
    const hold = {flightId:selectedFlight.id, seat:selectedSeat, passenger:$("passenger").value.trim()};
    if (online) {
      try {
        const response = await fetch("/api/holds", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(hold)});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
        $("hold-result").textContent = `Seat ${selectedSeat} held until ${result.expiresAt}.`;
      } catch (error) { $("hold-result").textContent = `Hold failed: ${error.message}`; }
    } else {
      const holds = JSON.parse(localStorage.getItem("eagledesk-holds") || "[]");
      if (holds.some(h => h.flightId === hold.flightId && h.seat === hold.seat)) { $("hold-result").textContent = "That seat is already held locally."; return; }
      holds.push(hold); localStorage.setItem("eagledesk-holds", JSON.stringify(holds));
      $("hold-result").textContent = `Seat ${selectedSeat} held locally for ${hold.passenger}.`;
    }
  });
  $("about").addEventListener("click", () => alert("{{SYSTEM_NAME}}\nBuilt by Mags and friends.\nPsst... try the Konami code."));
  let keys = [];
  document.addEventListener("keydown", event => { keys.push(event.key); keys = keys.slice(-10); if (keys.join(",") === "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a") alert("Quest 13: Build your own quest with hve-builder!"); });
  load();
})();
