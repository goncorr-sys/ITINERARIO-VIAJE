const STORAGE_KEYS = {
  edits: "itinerary-edits-2026-v2",
  places: "itinerary-tourism-2026-v2",
  theme: "itinerary-theme"
};

const state = {
  activeCategory: "TODAS",
  search: "",
  edits: loadJson(STORAGE_KEYS.edits, {}),
  places: loadJson(STORAGE_KEYS.places, {}),
  theme: localStorage.getItem(STORAGE_KEYS.theme) || "dark"
};

document.documentElement.dataset.theme = state.theme;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const livingCategory = "PARA VIVIR";
const extraCategories = ["EXCURSIONES", "GASTOS VARIOS NO CONTEMPLADOS"];
const cityWideBudgetCategories = ["ESTADIA", livingCategory];
const totalTripBudget = 13000;

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function currentData() {
  return itineraryData
    .map((item) => ({ ...item, ...(state.edits[item.id] || {}) }))
    .sort((a, b) => `${a.date}-${a.sourceRow}`.localeCompare(`${b.date}-${b.sourceRow}`))
    .map((item, index) => ({ ...item, travelDay: index + 1 }));
}

function money(value) {
  if (value === null || value === "" || Number.isNaN(Number(value))) return "A definir";
  return `USD ${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
}

function daysUntilTrip() {
  const firstDate = currentData()
    .map((item) => item.date)
    .filter(Boolean)
    .sort()[0];
  if (!firstDate) return "-";
  const [year, month, day] = firstDate.split("-").map(Number);
  const today = new Date();
  const start = new Date(year, month - 1, day);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.ceil((start - todayMidnight) / 86400000);
  if (diff > 1) return `${diff} días`;
  if (diff === 1) return "Mañana";
  if (diff === 0) return "Hoy";
  return "En viaje";
}

function hoursUntilTrip() {
  const firstDate = currentData()
    .map((item) => item.date)
    .filter(Boolean)
    .sort()[0];
  if (!firstDate) return "-";
  const [year, month, day] = firstDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const diff = Math.ceil((start - new Date()) / 3600000);
  if (diff > 0) return `${diff.toLocaleString("es-AR")} hs`;
  return "En viaje";
}

function localToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function dateFromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function categoryLabel(item) {
  const category = item.category?.trim() || "DIA LIBRE";
  if (category === "COMIDA") return livingCategory;
  if (category === "DISNEY") return "EXCURSIONES";
  return category;
}

function isCityWideBudget(item) {
  return cityWideBudgetCategories.includes(categoryLabel(item));
}

function costCity(item) {
  if (isTravelCity(item.city)) return item.city;
  if (item.arrivalPlace && item.arrivalPlace !== "Buenos Aires") return item.arrivalPlace.toUpperCase();
  return item.city || "SIN CIUDAD";
}

function allCategories() {
  return [...new Set([...currentData().map(categoryLabel), ...extraCategories])].sort((a, b) => a.localeCompare(b, "es"));
}

function isTravelCity(city) {
  return city && city !== "VUELO IDA Y VUELTA";
}

function mainRows() {
  return currentData().filter((item) => isTravelCity(item.city));
}

function movementRows() {
  return currentData().filter((item) => item.departurePlace || item.arrivalPlace);
}

function uniqueCities() {
  return [...new Set(mainRows().map((item) => item.city).filter(Boolean))];
}

function cityRows(city) {
  return mainRows().filter((item) => item.city === city);
}

function cityCountry(city) {
  const row = cityRows(city).find((item) => item.country);
  return row?.country || "";
}

function cityStays() {
  return uniqueCities().map((city) => {
    const rows = cityRows(city).sort((a, b) => a.date.localeCompare(b.date));
    const dates = [...new Set(rows.map((item) => item.date).filter(Boolean))];
    return {
      city,
      country: cityCountry(city),
      days: dates.length,
      from: dates[0],
      to: dates[dates.length - 1],
      rows
    };
  });
}

function costsByCategory(items = currentData()) {
  return items.reduce((acc, item) => {
    const label = categoryLabel(item);
    acc[label] = (acc[label] || 0) + (Number(item.usd) || 0);
    return acc;
  }, {});
}

function costsByCity() {
  return currentData().reduce((acc, item) => {
    const city = costCity(item);
    if (city === "VUELO IDA Y VUELTA" || city === "SIN CIUDAD") return acc;
    const category = categoryLabel(item);
    const value = Number(item.usd) || 0;
    acc[city] ??= { items: [], categories: {}, total: 0 };
    acc[city].items.push(item);
    acc[city].categories[category] = (acc[city].categories[category] || 0) + value;
    acc[city].total += value;
    return acc;
  }, {});
}

function paidRows() {
  return currentData().filter((item) => item.status === "PAGO");
}

function pendingRows() {
  return currentData().filter((item) => item.status !== "PAGO");
}

function dayTitle(item) {
  if (item.departurePlace && item.arrivalPlace) return `${item.departurePlace} → ${item.arrivalPlace}`;
  if (item.category === "ESTADIA") return `Presupuesto de estadía en ${item.city}`;
  if (item.category === "COMIDA") return `Presupuesto para vivir en ${item.city}`;
  if (item.category === "DISNEY") return `Excursiones en ${item.city}`;
  if (item.category) return `${item.category} en ${item.city}`;
  return `Día disponible en ${item.city}`;
}

function placesForDay(dayId) {
  return state.places[dayId] || [];
}

function placesForDate(date) {
  return currentData()
    .filter((item) => item.date === date)
    .flatMap((item) => placesForDay(item.id));
}

function renderStats() {
  const data = currentData();
  const paid = paidRows().reduce((sum, item) => sum + (Number(item.usd) || 0), 0);
  const remaining = totalTripBudget - paid;
  const stats = [
    { label: "Faltan", value: daysUntilTrip() },
    { label: "Horas", value: hoursUntilTrip() },
    { label: "Días totales", value: data.length },
    { label: "Ciudades", value: uniqueCities().length },
    { label: "Pagado", value: money(paid), private: true },
    { label: "Sobrante", value: money(remaining), private: true }
  ];
  $("#statsGrid").innerHTML = stats.map((stat) => `
    <article class="stat-card ${stat.private ? "is-private" : ""}" ${stat.private ? `data-private-value="${stat.value}" role="button" tabindex="0" aria-label="Mostrar ${stat.label}"` : ""}>
      <span>${stat.label}</span>
      <strong>${stat.private ? "••••••" : stat.value}</strong>
      ${stat.private ? `<em>Tocar para ver</em>` : ""}
    </article>
  `).join("");
}

function renderRoute() {
  const route = movementRows()
    .map((item) => item.arrivalPlace)
    .filter((place) => place && place !== "Buenos Aires");
  $("#routeCount").textContent = `${route.length} tramos`;
  $("#routeStrip").innerHTML = route.map((city, index) => `
    <div class="route-stop">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${city}</strong>
    </div>
  `).join("");
}

function renderStays() {
  $("#stayGrid").innerHTML = cityStays().map((stay) => `
    <article class="stay-card" data-city-detail="${stay.city}" role="button" tabindex="0" aria-label="Ver gastos de ${stay.city}">
      <span>${stay.country || "País por completar"}</span>
      <strong>${stay.city}</strong>
      <p>${stay.days} días · ${formatDate(stay.from)} al ${formatDate(stay.to)}</p>
    </article>
  `).join("");
}

function renderBudgetChart() {
  const byCategory = costsByCategory();
  const rows = Object.entries(byCategory)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  $("#budgetChart").innerHTML = rows.map(([category, value]) => {
    const pct = totalTripBudget ? (value / totalTripBudget) * 100 : 0;
    return `
      <article class="budget-row">
        <div class="budget-row-head">
          <span>${category}</span>
          <strong>${pct.toFixed(1)}% · ${money(value)}</strong>
        </div>
      </article>
    `;
  }).join("");
}

function renderReviewList() {
  const data = currentData();
  const transfer = data.find((item) => item.city === "MADRID" && item.departurePlace === "Barcelona" && item.arrivalPlace === "Madrid");
  const pendingMoney = pendingRows().filter((item) => item.usd === null || item.usd === "");
  const flexible = data.filter((item) => !item.locked && item.status !== "PAGO").slice(0, 5);
  const notices = [];

  if (transfer) {
    notices.push({
      title: "Barcelona a Madrid",
      body: `${formatDate(transfer.date)} · ${transfer.category || "Traslado"} pendiente de definir valor, horario y confirmación.`
    });
  }

  pendingMoney.forEach((item) => notices.push({
    title: `${item.city} · ${formatDate(item.date)}`,
    body: `${categoryLabel(item)} sin valor cargado todavía.`
  }));

  notices.push({
    title: "Items flexibles",
    body: `${flexible.length} filas pendientes se pueden mover de fecha o ajustar valor desde el botón Editar.`
  });

  $("#reviewList").innerHTML = notices.map((notice) => `
    <article class="notice-card">
      <strong>${notice.title}</strong>
      <span>${notice.body}</span>
    </article>
  `).join("");
}

function renderCategoryFilters() {
  const categories = ["TODAS", ...allCategories()];
  $("#categoryFilters").innerHTML = categories.map((cat) => `
    <button class="chip ${state.activeCategory === cat ? "is-active" : ""}" data-category="${cat}" type="button">${cat}</button>
  `).join("");
}

function renderCategoryOptions() {
  $("#categoryOptions").innerHTML = allCategories()
    .map((category) => `<option value="${category}"></option>`)
    .join("");
}

function filteredDays() {
  const search = state.search.trim().toLowerCase();
  return currentData().filter((item) => {
    const matchesCategory = state.activeCategory === "TODAS" || categoryLabel(item) === state.activeCategory;
    const haystack = [
      item.city,
      item.date,
      item.departureTime,
      item.departurePlace,
      item.arrivalTime,
      item.arrivalPlace,
      item.country,
      item.category,
      item.usd,
      item.payer,
      item.status,
      item.note
    ].join(" ").toLowerCase();
    return matchesCategory && (!search || haystack.includes(search));
  });
}

function renderDayList() {
  const days = filteredDays();
  $("#dayList").innerHTML = days.length ? days.map((item) => {
    const places = placesForDay(item.id);
    const hasEdit = Boolean(state.edits[item.id]);
    return `
      <article class="day-card ${item.status === "PAGO" ? "is-paid" : ""}" id="day-${item.id}">
        <div class="day-date">
          <span>Día ${item.travelDay}</span>
          <strong>${formatDate(item.date)}</strong>
        </div>
        <div class="day-body">
          <div class="card-title-row">
            <h3>${dayTitle(item)}</h3>
            <span class="pill">${item.status}</span>
          </div>
          <div class="detail-grid">
            <span>Ciudad</span><strong>${item.city}</strong>
            <span>Categoría</span><strong>${categoryLabel(item)}</strong>
            <span>Alcance</span><strong>${isCityWideBudget(item) ? `Toda la estadía en ${item.city}` : "Día puntual / traslado"}</strong>
            <span>Salida</span><strong>${item.departureTime || "-"} ${item.departurePlace || ""}</strong>
            <span>Llegada</span><strong>${item.arrivalTime || "-"} ${item.arrivalPlace || ""}</strong>
            <span>USD</span><strong>${money(item.usd)}</strong>
            <span>Pagó</span><strong>${item.payer || "-"}</strong>
          </div>
          ${item.note ? `<p class="inline-warning">${item.note}</p>` : ""}
          ${hasEdit ? `<p class="inline-success">Modificado localmente.</p>` : ""}
          <div class="places-preview">
            <span>Lugares turísticos</span>
            ${places.length ? places.map((place) => `<strong>${place.name}</strong>`).join("") : `<em>Por definir</em>`}
          </div>
          <button class="ghost-button edit-item" data-edit="${item.id}" type="button">Editar</button>
        </div>
      </article>
    `;
  }).join("") : `<p class="empty-state">No hay días con esos filtros.</p>`;
}

function renderCities() {
  const byCity = costsByCity();
  $("#cityGrid").innerHTML = cityStays().map((stay) => {
    const spend = byCity[stay.city]?.total || 0;
    const paid = stay.rows.filter((item) => item.status === "PAGO").length;
    const places = stay.rows.flatMap((item) => placesForDay(item.id));
    return `
      <article class="city-card">
        <div>
          <span>${stay.country || "País por completar"}</span>
          <h3>${stay.city}</h3>
        </div>
        <div class="city-metrics">
          <strong>${stay.days}</strong><span>días</span>
          <strong>${paid}</strong><span>confirmados/pagos</span>
          <strong>${money(spend)}</strong><span>estimado</span>
        </div>
        <div class="places-preview">
          <span>Lugares cargados</span>
          ${places.length ? places.slice(0, 4).map((place) => `<strong>${place.name}</strong>`).join("") : `<em>Listo para planificar</em>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderCalendar() {
  const data = currentData();
  const dates = data.map((item) => item.date).filter(Boolean).sort();
  if (!dates.length) return;

  const today = localToday();
  const firstTrip = dateFromIso(dates[0]);
  const lastTrip = dateFromIso(dates[dates.length - 1]);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(lastTrip.getFullYear(), lastTrip.getMonth(), 1);
  const months = [];

  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push(new Date(d));
  }

  $("#calendarCount").textContent = `Faltan ${daysUntilTrip()}`;
  $("#calendarGrid").innerHTML = months.map((monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const cells = [];

    for (let i = 0; i < offset; i += 1) cells.push(`<div class="calendar-cell is-empty"></div>`);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = isoFromDate(date);
      const dayItems = data.filter((item) => item.date === iso);
      const dayPlaces = placesForDate(iso);
      const isPast = date < today;
      const isTrip = date >= firstTrip && date <= lastTrip;
      const isPaid = dayItems.some((item) => item.status === "PAGO");
      const isPending = dayItems.some((item) => item.status !== "PAGO");
      const classes = [
        "calendar-cell",
        isPast ? "is-past" : "",
        isTrip ? "is-trip" : "",
        isPaid ? "has-paid" : "",
        isPending ? "has-pending" : ""
      ].filter(Boolean).join(" ");
      cells.push(`
        <article class="${classes}" data-calendar-date="${iso}" role="button" tabindex="0" aria-label="Ver detalle de ${formatDate(iso)}">
          <strong>${day}</strong>
          ${dayItems.slice(0, 2).map((item) => `
            <span class="calendar-tag">${item.city}</span>
            <small>${isCityWideBudget(item) ? `${categoryLabel(item)} ciudad` : categoryLabel(item)}</small>
          `).join("")}
          ${dayPlaces.slice(0, 3).map((place) => `
            <em>${place.category ? `${place.category}: ` : ""}${place.name}</em>
          `).join("")}
        </article>
      `);
    }

    return `
      <section class="calendar-month">
        <h3>${new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(monthDate)}</h3>
        <div class="weekday-row">
          <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div class="month-grid">${cells.join("")}</div>
      </section>
    `;
  }).join("");
}

function renderCalendarDetail(date) {
  const items = currentData().filter((item) => item.date === date);
  const places = placesForDate(date);
  $("#calendarDetailTitle").textContent = formatDate(date);
  $("#calendarDetailBody").innerHTML = `
    <div class="calendar-detail-list">
      ${items.length ? items.map((item) => `
        <article class="detail-card">
          <div class="card-title-row">
            <h3>${dayTitle(item)}</h3>
            <span class="pill">${item.status}</span>
          </div>
          <div class="detail-grid">
            <span>Ciudad</span><strong>${item.city}</strong>
            <span>Categoría</span><strong>${categoryLabel(item)}</strong>
            <span>Alcance</span><strong>${isCityWideBudget(item) ? `Toda la estadía en ${item.city}` : "Día puntual / traslado"}</strong>
            <span>Salida</span><strong>${item.departureTime || "-"} ${item.departurePlace || ""}</strong>
            <span>Llegada</span><strong>${item.arrivalTime || "-"} ${item.arrivalPlace || ""}</strong>
            <span>USD</span><strong>${money(item.usd)}</strong>
          </div>
          ${item.note ? `<p class="inline-warning">${item.note}</p>` : ""}
        </article>
      `).join("") : `<p class="empty-state">No hay items del itinerario cargados para esta fecha.</p>`}
      <div class="detail-card">
        <h3>Lugares y excursiones</h3>
        ${places.length ? places.map((place) => `
          <div class="place-item compact-place">
            <strong>${place.name}</strong>
            <span>${place.category || "Categoría por definir"} · ${place.time || "Horario por definir"}</span>
            <p>${place.note || "Sin nota cargada."}</p>
          </div>
        `).join("") : `<p class="empty-state">Todavía no hay lugares cargados para este día.</p>`}
      </div>
    </div>
  `;
  $("#calendarDialog").showModal();
}

function closeCalendarDetail() {
  $("#calendarDialog").close();
}

function renderCosts() {
  const data = currentData();
  const byCategory = costsByCategory(data);
  const byCityBudget = costsByCity();
  const estimatedTotal = Object.values(byCategory).reduce((sum, value) => sum + value, 0);
  const paid = paidRows().reduce((sum, item) => sum + (Number(item.usd) || 0), 0);
  const pending = totalTripBudget - paid;
  $("#costSummary").innerHTML = `
    <article>
      <span>Presupuesto total</span>
      <strong>${money(totalTripBudget)}</strong>
      <p>Presupuesto global definido para todo el viaje.</p>
    </article>
    <article>
      <span>Gastado del presupuesto total</span>
      <strong>${money(paid)}</strong>
      <p>Calculado solamente con los items marcados como PAGO.</p>
    </article>
    <article>
      <span>Sobrante</span>
      <strong>${money(pending)}</strong>
      <p>Diferencia entre USD 13.000 y lo gastado hasta el momento. Estimado cargado: ${money(estimatedTotal)}.</p>
    </article>
  `;
  const cityBudgetRows = Object.entries(byCityBudget).map(([city, values]) => {
    const categoryRows = Object.entries(values.categories)
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([category, value]) => `<span>${category}: ${money(value)}</span>`)
      .join("");
    return `
    <article class="cost-city-row">
      <div>
        <span>Gasto por ciudad</span>
        <strong>${city}</strong>
      </div>
      <div class="cost-city-breakdown">
        ${categoryRows}
        <strong>${money(values.total)}</strong>
      </div>
    </article>
  `;
  }).join("");
  const otherRows = Object.entries(byCategory).map(([category, value]) => `
    <article class="cost-row">
      <span>${category}</span>
      <strong>${money(value)}</strong>
    </article>
  `).join("");
  $("#costList").innerHTML = `
    ${cityBudgetRows}
    ${otherRows ? `<div class="cost-subheading">Total por categoría</div>${otherRows}` : ""}
  `;
}

function renderCityDetail(city) {
  const cityData = costsByCity()[city];
  $("#cityDetailTitle").textContent = city;
  if (!cityData) {
    $("#cityDetailBody").innerHTML = `<p class="empty-state">No hay gastos cargados para esta ciudad.</p>`;
    $("#cityDialog").showModal();
    return;
  }
  const categoryRows = Object.entries(cityData.categories)
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([category, value]) => `
      <article class="cost-row">
        <span>${category}</span>
        <strong>${money(value)}</strong>
      </article>
    `).join("");
  const itemRows = cityData.items
    .filter((item) => Number(item.usd) || item.category || item.departurePlace || item.arrivalPlace)
    .map((item) => `
      <article class="detail-card">
        <div class="card-title-row">
          <h3>${dayTitle(item)}</h3>
          <span class="pill">${item.status}</span>
        </div>
        <div class="detail-grid">
          <span>Fecha</span><strong>${formatDate(item.date)}</strong>
          <span>Categoría</span><strong>${categoryLabel(item)}</strong>
          <span>Alcance</span><strong>${isCityWideBudget(item) ? `Toda la estadía en ${item.city}` : "Día puntual / traslado"}</strong>
          <span>USD</span><strong>${money(item.usd)}</strong>
        </div>
      </article>
    `).join("");
  $("#cityDetailBody").innerHTML = `
    <div class="calendar-detail-list">
      <article class="detail-card">
        <span>Total ciudad</span>
        <strong class="detail-total">${money(cityData.total)}</strong>
      </article>
      <div class="cost-list">${categoryRows}</div>
      <div class="cost-subheading">Gastos individuales</div>
      ${itemRows}
    </div>
  `;
  $("#cityDialog").showModal();
}

function closeCityDetail() {
  $("#cityDialog").close();
}

function renderPlannerOptions() {
  $("#placeDay").innerHTML = currentData().map((item) => `
    <option value="${item.id}">Día ${item.travelDay} - ${item.city} - ${formatDate(item.date)}</option>
  `).join("");
}

function renderTourismList() {
  const entries = currentData().filter((item) => placesForDay(item.id).length);
  $("#tourismList").innerHTML = entries.length ? entries.map((item) => `
    <article class="tourism-day">
      <div>
        <span>Día ${item.travelDay} · ${item.city}</span>
        <h3>${formatDate(item.date)}</h3>
      </div>
      ${placesForDay(item.id).map((place, index) => `
        <div class="place-item">
          <button class="delete-place" data-day="${item.id}" data-index="${index}" type="button" aria-label="Eliminar lugar">×</button>
          <strong>${place.name}</strong>
          <span>${place.category || "Categoría por definir"}</span>
          <span>${place.time || "Horario por definir"}</span>
          <p>${place.note || "Sin nota cargada."}</p>
        </div>
      `).join("")}
    </article>
  `).join("") : `<p class="empty-state">Todavía no hay lugares turísticos cargados. Agregalos por día y quedan guardados en este dispositivo.</p>`;
}

function renderSourceTable() {
  const rows = currentData().map((item) => [
    item.city,
    item.date,
    item.departureTime,
    item.departurePlace,
    item.arrivalTime,
    item.arrivalPlace,
    item.country,
    item.category,
    item.usd ?? "",
    item.payer,
    item.status
  ]);
  $("#sourceTable").innerHTML = `
    <thead><tr>${sourceColumns.map((col) => `<th>${col}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell || ""}</td>`).join("")}</tr>`).join("")}</tbody>
  `;
}

function renderAll() {
  renderStats();
  renderRoute();
  renderStays();
  renderBudgetChart();
  renderReviewList();
  renderCategoryFilters();
  renderCategoryOptions();
  renderDayList();
  renderCities();
  renderCalendar();
  renderCosts();
  renderPlannerOptions();
  renderTourismList();
  renderSourceTable();
}

function switchView(target) {
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === target));
  $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.target === target));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openEdit(id) {
  const item = currentData().find((entry) => entry.id === id);
  if (!item) return;
  $("#editId").value = item.id;
  $("#editCity").value = item.city || "";
  $("#editDate").value = item.date || "";
  $("#editCategory").value = item.category || "";
  $("#editUsd").value = item.usd ?? "";
  $("#editStatus").value = item.status || "PENDIENTE";
  $("#editPayer").value = item.payer || "";
  $("#editDepartureTime").value = item.departureTime || "";
  $("#editDeparturePlace").value = item.departurePlace || "";
  $("#editArrivalTime").value = item.arrivalTime || "";
  $("#editArrivalPlace").value = item.arrivalPlace || "";
  $("#editNote").value = item.note || "";
  $("#editTitle").textContent = `${item.city} · ${formatDate(item.date)}`;
  $("#editDialog").showModal();
}

function closeEdit() {
  $("#editDialog").close();
}

function saveEdit(event) {
  event.preventDefault();
  const id = $("#editId").value;
  const usdValue = $("#editUsd").value;
  state.edits[id] = {
    city: $("#editCity").value.trim(),
    date: $("#editDate").value,
    category: $("#editCategory").value.trim(),
    usd: usdValue === "" ? null : Number(usdValue),
    status: $("#editStatus").value,
    payer: $("#editPayer").value.trim(),
    departureTime: $("#editDepartureTime").value,
    departurePlace: $("#editDeparturePlace").value.trim(),
    arrivalTime: $("#editArrivalTime").value,
    arrivalPlace: $("#editArrivalPlace").value.trim(),
    note: $("#editNote").value.trim()
  };
  saveJson(STORAGE_KEYS.edits, state.edits);
  closeEdit();
  renderAll();
}

function resetEdits() {
  if (!confirm("Esto borra los cambios locales de fechas, valores y estados. Los lugares turísticos cargados se mantienen. ¿Continuar?")) return;
  state.edits = {};
  saveJson(STORAGE_KEYS.edits, state.edits);
  renderAll();
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest(".nav-button");
  if (nav) switchView(nav.dataset.target);

  const jump = event.target.closest("[data-jump]");
  if (jump) switchView(jump.dataset.jump);

  const chip = event.target.closest(".chip");
  if (chip) {
    state.activeCategory = chip.dataset.category;
    renderCategoryFilters();
    renderDayList();
  }

  const edit = event.target.closest("[data-edit]");
  if (edit) openEdit(edit.dataset.edit);

  const calendarCell = event.target.closest("[data-calendar-date]");
  if (calendarCell) renderCalendarDetail(calendarCell.dataset.calendarDate);

  const cityCard = event.target.closest("[data-city-detail]");
  if (cityCard) renderCityDetail(cityCard.dataset.cityDetail);

  const privateCard = event.target.closest(".stat-card.is-private");
  if (privateCard) {
    privateCard.classList.toggle("is-revealed");
    privateCard.querySelector("strong").textContent = privateCard.classList.contains("is-revealed")
      ? privateCard.dataset.privateValue
      : "••••••";
  }

  const deleteButton = event.target.closest(".delete-place");
  if (deleteButton) {
    const day = deleteButton.dataset.day;
    const index = Number(deleteButton.dataset.index);
    state.places[day].splice(index, 1);
    if (!state.places[day].length) delete state.places[day];
    saveJson(STORAGE_KEYS.places, state.places);
    renderAll();
  }
});

$("#searchInput").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderDayList();
});

$("#clearFilters").addEventListener("click", () => {
  state.activeCategory = "TODAS";
  state.search = "";
  $("#searchInput").value = "";
  renderCategoryFilters();
  renderDayList();
});

$("#resetEdits").addEventListener("click", resetEdits);
$("#editForm").addEventListener("submit", saveEdit);
$("#closeEdit").addEventListener("click", closeEdit);
$("#cancelEdit").addEventListener("click", closeEdit);
$("#closeCalendarDetail").addEventListener("click", closeCalendarDetail);
$("#closeCityDetail").addEventListener("click", closeCityDetail);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const calendarCell = event.target.closest?.("[data-calendar-date]");
  const cityCard = event.target.closest?.("[data-city-detail]");
  const privateCard = event.target.closest?.(".stat-card.is-private");
  if (!calendarCell && !cityCard && !privateCard) return;
  event.preventDefault();
  if (calendarCell) renderCalendarDetail(calendarCell.dataset.calendarDate);
  if (cityCard) renderCityDetail(cityCard.dataset.cityDetail);
  if (privateCard) privateCard.click();
});

$("#placeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const day = $("#placeDay").value;
  const place = {
    name: $("#placeName").value.trim(),
    category: $("#placeCategory").value.trim(),
    time: $("#placeTime").value.trim(),
    note: $("#placeNote").value.trim()
  };
  if (!place.name) return;
  state.places[day] = [...(state.places[day] || []), place];
  saveJson(STORAGE_KEYS.places, state.places);
  event.target.reset();
  $("#placeDay").value = day;
  renderAll();
});

$("#exportPlan").addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    itinerary: currentData(),
    tourism: state.places
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "itinerario-viaje-2026-plan.json";
  a.click();
  URL.revokeObjectURL(url);
});

$("#themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}

renderAll();
