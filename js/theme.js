export const THEME_STORAGE_KEY = "lavarent_theme";
export const THEMES = ["dark", "light"];
export const DEFAULT_THEME = "dark";

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme) {
  const next = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next === "light" ? "light" : "dark";
  syncThemeControls(next);
  return next;
}

export function setTheme(theme) {
  const next = applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  return next;
}

function syncThemeControls(theme) {
  document.querySelectorAll("[data-theme-option]").forEach((btn) => {
    const active = btn.dataset.themeOption === theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function mountThemeSwitch(container) {
  if (!container || container.dataset.themeMounted === "1") return;
  container.dataset.themeMounted = "1";
  container.innerHTML = `
    <span class="theme-switch-label">Tema</span>
    <div class="theme-switch" role="group" aria-label="Tema de la interfaz">
      <button type="button" class="theme-option" data-theme-option="light" aria-pressed="false">
        Claro
      </button>
      <button type="button" class="theme-option" data-theme-option="dark" aria-pressed="false">
        Oscuro
      </button>
    </div>
  `;
  container.querySelectorAll("[data-theme-option]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeOption));
  });
  syncThemeControls(getStoredTheme());
}

export function initTheme() {
  applyTheme(getStoredTheme());
  mountThemeSwitch(document.getElementById("theme-switch"));
}
