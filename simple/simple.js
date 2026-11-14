const form = document.getElementById("movie-form");
const input = document.getElementById("movie-input");
const list = document.getElementById("movie-list");
const count = document.getElementById("count");
const emptyMessage = document.getElementById("empty-message");

const movies = [];

function renderMovies() {
  list.innerHTML = "";
  movies.forEach((movie, index) => {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.className = "movie-title";
    title.textContent = movie;

    const removeButton = document.createElement("button");
    removeButton.className = "remove";
    removeButton.type = "button";
    removeButton.textContent = "Eliminar";
    removeButton.addEventListener("click", () => {
      movies.splice(index, 1);
      renderMovies();
    });

    item.append(title, removeButton);
    list.appendChild(item);
  });

  count.textContent = `${movies.length} ${movies.length === 1 ? "película" : "películas"}`;
  emptyMessage.hidden = movies.length > 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  movies.push(title);
  input.value = "";
  renderMovies();
  input.focus();
});

renderMovies();
