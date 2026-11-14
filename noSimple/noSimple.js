const $ = (id) => document.getElementById(id);
const GENRES = [
  "Acción",
  "Animación",
  "Comedia",
  "Drama",
  "Terror",
  "Ciencia ficción",
  "Documental",
  "Romance",
];
const TIPS = [
  "Arrastra una tarjeta para reordenarla (orden manual).",
  "Pulsa / para buscar rápido.",
  "La tecla g cambia entre las 4 vistas.",
  "Puedes seleccionar varias películas y eliminarlas juntas.",
  "Deshacer (u) revierte la última acción.",
  "Exporta tu colección a JSON o CSV.",
  "Importa un JSON para fusionar colecciones.",
  "La estrella marca tus favoritas.",
  "El botón Sorpréndeme elige una pendiente al azar.",
  "Las estadísticas se recalculan con cada cambio.",
  "El tema oscuro se recuerda entre visitas.",
  "Pulsa ? para ver todos los atajos.",
];

const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* sin almacenamiento */
    }
  },
};

let movies = store.get("pro.movies", []);
let prefs = store.get("pro.prefs", {
  view: "lista",
  theme: "claro",
  page: 1,
  size: 10,
});
let selected = new Set();
let history = [];
let tipIndex = 0;
let dragId = null;
let toastTimer;

const save = () => {
  store.set("pro.movies", movies);
  store.set("pro.prefs", prefs);
};
const snapshot = () => {
  history.push(JSON.stringify(movies));
  if (history.length > 20) history.shift();
  $("btn-undo").disabled = false;
};
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

function fillSelects() {
  $("f-genre").innerHTML = GENRES.map((g) => `<option>${g}</option>`).join("");
  $("flt-genre").innerHTML =
    `<option value="">Todos los géneros</option>` +
    GENRES.map((g) => `<option>${g}</option>`).join("");
}

function filtered() {
  const q = $("q").value.trim().toLowerCase();
  const st = $("flt-status").value,
    ge = $("flt-genre").value;
  const min = +$("flt-rating").value,
    fav = $("flt-fav").checked;
  let r = movies.filter(
    (m) =>
      (!q ||
        [m.title, m.director, m.notes, ...m.tags]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!st || m.status === st) &&
      (!ge || m.genre === ge) &&
      m.rating >= min &&
      (!fav || m.fav),
  );
  const s = $("sort").value;
  if (s === "titulo") r.sort((a, b) => a.title.localeCompare(b.title, "es"));
  if (s === "anio") r.sort((a, b) => (b.year || 0) - (a.year || 0));
  if (s === "nota") r.sort((a, b) => b.rating - a.rating);
  if (s === "agregada") r.sort((a, b) => b.created - a.created);
  return r;
}

function renderStats() {
  const rated = movies.filter((m) => m.rating > 0);
  const avg = rated.length
    ? (rated.reduce((a, m) => a + m.rating, 0) / rated.length).toFixed(1)
    : "–";
  const top = GENRES.map((g) => [
    g,
    movies.filter((m) => m.genre === g).length,
  ]).sort((a, b) => b[1] - a[1])[0];
  const items = [
    [movies.length, "Total"],
    [movies.filter((m) => m.status === "vista").length, "Vistas"],
    [movies.filter((m) => m.status === "pendiente").length, "Pendientes"],
    [movies.filter((m) => m.fav).length, "Favoritas"],
    [avg, "Nota promedio"],
    [top && top[1] ? top[0] : "–", "Género principal"],
  ];
  $("stats").innerHTML = items
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
    .join("");
}

function cardHTML(m) {
  return `<input type="checkbox" data-sel="${m.id}" ${selected.has(m.id) ? "checked" : ""} aria-label="Seleccionar ${esc(m.title)}">
  <div class="body">
    <div class="movie-title">${esc(m.title)} ${m.year ? `(${m.year})` : ""}</div>
    <p class="meta">${esc(m.director || "Director desconocido")} · ${m.genre} · ${m.rating}/10${m.date ? " · vista el " + m.date : ""}</p>
    <span class="badge">${m.status}</span>${m.tags.map((t) => `<span class="badge">#${esc(t)}</span>`).join("")}
    ${m.notes ? `<p class="notes">${esc(m.notes)}</p>` : ""}
  </div>
  <div class="actions">
    <button class="fav" data-fav="${m.id}" aria-label="Favorita">${m.fav ? "★" : "☆"}</button>
    <button class="ghost" data-edit="${m.id}">Editar</button>
    <button class="ghost danger" data-del="${m.id}">Eliminar</button>
  </div>`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  const all = filtered();
  const pages = Math.max(1, Math.ceil(all.length / prefs.size));
  prefs.page = Math.min(prefs.page, pages);
  const slice = all.slice(
    (prefs.page - 1) * prefs.size,
    prefs.page * prefs.size,
  );
  const list = $("movie-list");
  list.className = prefs.view === "tabla" ? "" : prefs.view;
  if (prefs.view === "tabla") {
    list.innerHTML = `<table><thead><tr><th></th><th>Título</th><th>Año</th><th>Género</th><th>Estado</th><th>Nota</th><th></th></tr></thead><tbody>${slice
      .map(
        (m) =>
          `<tr><td><input type="checkbox" data-sel="${m.id}" ${selected.has(m.id) ? "checked" : ""}></td><td>${esc(m.title)}</td><td>${m.year || ""}</td><td>${m.genre}</td><td>${m.status}</td><td>${m.rating}</td><td><button class="ghost danger" data-del="${m.id}">Eliminar</button></td></tr>`,
      )
      .join("")}</tbody></table>`;
  } else {
    list.innerHTML = "";
    slice.forEach((m) => {
      const li = document.createElement("li");
      li.className = "card";
      li.draggable = $("sort").value === "manual";
      li.dataset.id = m.id;
      li.innerHTML = cardHTML(m);
      list.appendChild(li);
    });
  }
  $("count").textContent = `${all.length} de ${movies.length} películas`;
  $("empty-message").hidden = all.length > 0;
  $("page-info").textContent = `Página ${prefs.page} de ${pages}`;
  $("prev").disabled = prefs.page <= 1;
  $("next").disabled = prefs.page >= pages;
  $("sel-count").textContent = `${selected.size} seleccionadas`;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("on", b.dataset.view === prefs.view));
  document.documentElement.dataset.theme = prefs.theme;
  $("btn-theme").textContent = `Tema: ${prefs.theme}`;
  $("page-size").value = prefs.size;
  renderStats();
  save();
}

$("f-rating").addEventListener(
  "input",
  () => ($("f-rating-out").textContent = $("f-rating").value),
);
$("f-notes").addEventListener(
  "input",
  () => ($("f-count").textContent = `${$("f-notes").value.length}/280`),
);

$("movie-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("f-title").value.trim();
  if (!title) return;
  if (
    movies.some(
      (m) =>
        m.title.toLowerCase() === title.toLowerCase() &&
        !confirm(
          "Ya existe una película con ese nombre. ¿Agregarla de todos modos?",
        ),
    )
  )
    return;
  snapshot();
  movies.unshift({
    id: uid(),
    title,
    year: +$("f-year").value || null,
    director: $("f-director").value.trim(),
    genre: $("f-genre").value,
    status: $("f-status").value,
    rating: +$("f-rating").value,
    date: $("f-date").value,
    fav: $("f-fav").checked,
    tags: $("f-tags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    notes: $("f-notes").value.trim(),
    created: Date.now(),
  });
  $("movie-form").reset();
  $("f-rating-out").textContent = "0";
  $("f-count").textContent = "0/280";
  toast(`«${title}» agregada`);
  render();
  $("f-title").focus();
});

["q", "flt-status", "flt-genre", "flt-rating", "flt-fav", "sort"].forEach(
  (id) =>
    $(id).addEventListener("input", () => {
      prefs.page = 1;
      render();
    }),
);
$("btn-reset-filters").addEventListener("click", () => {
  $("q").value = "";
  ["flt-status", "flt-genre"].forEach((i) => ($(i).value = ""));
  $("flt-rating").value = "0";
  $("flt-fav").checked = false;
  $("sort").value = "manual";
  prefs.page = 1;
  render();
});

document.querySelector(".views").addEventListener("click", (e) => {
  if (e.target.dataset.view) {
    prefs.view = e.target.dataset.view;
    render();
  }
});
$("prev").addEventListener("click", () => {
  prefs.page--;
  render();
});
$("next").addEventListener("click", () => {
  prefs.page++;
  render();
});
$("page-size").addEventListener("change", (e) => {
  prefs.size = +e.target.value;
  prefs.page = 1;
  render();
});

$("movie-list").addEventListener("click", (e) => {
  const t = e.target,
    byId = (id) => movies.find((m) => m.id === id);
  if (t.dataset.fav) {
    snapshot();
    byId(t.dataset.fav).fav ^= 1;
    render();
  }
  if (t.dataset.del) {
    snapshot();
    movies = movies.filter((m) => m.id !== t.dataset.del);
    selected.delete(t.dataset.del);
    toast("Película eliminada. Pulsa u para deshacer.");
    render();
  }
  if (t.dataset.edit) openEdit(t.dataset.edit);
  if (t.dataset.sel) {
    t.checked ? selected.add(t.dataset.sel) : selected.delete(t.dataset.sel);
    $("sel-count").textContent = `${selected.size} seleccionadas`;
  }
});

let editing = null;
function openEdit(id) {
  editing = movies.find((m) => m.id === id);
  $("e-title").value = editing.title;
  $("e-year").value = editing.year || "";
  $("e-notes").value = editing.notes;
  $("dlg-edit").showModal();
}
$("dlg-edit").addEventListener("close", () => {
  if ($("dlg-edit").returnValue !== "ok" || !editing) return;
  snapshot();
  editing.title = $("e-title").value.trim() || editing.title;
  editing.year = +$("e-year").value || null;
  editing.notes = $("e-notes").value.trim();
  toast("Cambios guardados");
  render();
});

$("sel-all").addEventListener("change", (e) => {
  selected = e.target.checked
    ? new Set(filtered().map((m) => m.id))
    : new Set();
  render();
});
document.querySelector(".bulk").addEventListener("click", (e) => {
  const b = e.target.dataset.bulk;
  if (!b || !selected.size) return;
  snapshot();
  if (b === "del") movies = movies.filter((m) => !selected.has(m.id));
  if (b === "vista")
    movies.forEach((m) => selected.has(m.id) && (m.status = "vista"));
  if (b === "fav")
    movies.forEach((m) => selected.has(m.id) && (m.fav = !m.fav));
  if (b === "del") selected.clear();
  toast("Acción masiva aplicada");
  render();
});

function undo() {
  if (!history.length) return toast("No hay nada que deshacer");
  movies = JSON.parse(history.pop());
  $("btn-undo").disabled = !history.length;
  toast("Acción deshecha");
  render();
}
$("btn-undo").addEventListener("click", undo);

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("btn-export-json").addEventListener("click", () =>
  download(
    "peliculas.json",
    JSON.stringify(movies, null, 2),
    "application/json",
  ),
);
$("btn-export-csv").addEventListener("click", () => {
  const rows = [
    ["titulo", "anio", "director", "genero", "estado", "nota", "favorita"],
    ...movies.map((m) => [
      m.title,
      m.year,
      m.director,
      m.genre,
      m.status,
      m.rating,
      m.fav,
    ]),
  ];
  download(
    "peliculas.csv",
    rows
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n"),
    "text/csv",
  );
});
$("btn-import").addEventListener("change", async (e) => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data)) throw new Error();
    snapshot();
    data.forEach(
      (m) =>
        m.title &&
        movies.push({
          tags: [],
          notes: "",
          rating: 0,
          genre: GENRES[0],
          status: "pendiente",
          ...m,
          id: uid(),
          created: Date.now(),
        }),
    );
    toast(`${data.length} películas importadas`);
    render();
  } catch {
    toast("El archivo no es un JSON válido");
  }
  e.target.value = "";
});
$("btn-wipe").addEventListener("click", () => {
  if (
    movies.length &&
    confirm("¿Borrar TODA la colección?") &&
    confirm("¿Seguro? Esto se puede deshacer una vez.")
  ) {
    snapshot();
    movies = [];
    selected.clear();
    render();
  }
});

function randomPick() {
  const pool = movies.filter((m) => m.status === "pendiente");
  if (!pool.length) return toast("No tienes películas pendientes");
  const m = pool[Math.floor(Math.random() * pool.length)];
  toast(`Hoy toca: ${m.title}`);
}
$("btn-random").addEventListener("click", randomPick);
$("btn-theme").addEventListener("click", toggleTheme);
$("btn-shortcuts").addEventListener("click", () => $("dlg-keys").showModal());
function toggleTheme() {
  prefs.theme = prefs.theme === "claro" ? "oscuro" : "claro";
  render();
}
function nextView() {
  const v = ["lista", "cuadricula", "compacta", "tabla"];
  prefs.view = v[(v.indexOf(prefs.view) + 1) % v.length];
  render();
}

$("tour-next").addEventListener("click", () => {
  tipIndex = (tipIndex + 1) % TIPS.length;
  $("tour-next").textContent = `Siguiente consejo (${tipIndex + 1}/12)`;
  toast(TIPS[tipIndex]);
});
$("tour-close").addEventListener("click", () => ($("tour").hidden = true));

const list = $("movie-list");
list.addEventListener("dragstart", (e) => {
  const li = e.target.closest("li");
  if (li) {
    dragId = li.dataset.id;
    li.classList.add("drag");
  }
});
list.addEventListener("dragend", (e) => e.target.classList.remove("drag"));
list.addEventListener("dragover", (e) => {
  e.preventDefault();
  const li = e.target.closest("li");
  document.querySelectorAll(".over").forEach((x) => x.classList.remove("over"));
  li && li.classList.add("over");
});
list.addEventListener("drop", (e) => {
  const li = e.target.closest("li");
  if (!li || !dragId || li.dataset.id === dragId) return;
  snapshot();
  const from = movies.findIndex((m) => m.id === dragId),
    to = movies.findIndex((m) => m.id === li.dataset.id);
  movies.splice(to, 0, movies.splice(from, 1)[0]);
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") && e.key !== "Escape") return;
  const k = e.key;
  if (k === "/") {
    e.preventDefault();
    $("q").focus();
  }
  if (k === "n") {
    e.preventDefault();
    $("f-title").focus();
  }
  if (k === "r") randomPick();
  if (k === "t") toggleTheme();
  if (k === "g") nextView();
  if (k === "u") undo();
  if (k === "a") {
    $("sel-all").checked = true;
    $("sel-all").dispatchEvent(new Event("change"));
  }
  if (k === "?") $("dlg-keys").showModal();
});

fillSelects();
render();
