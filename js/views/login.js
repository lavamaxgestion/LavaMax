import { api, isMockMode } from "../api.js";
import { setSession } from "../auth.js";

const MAX_PIN = 6;

export function mountLogin(container, onSuccess) {
  let pin = "";
  let loading = false;

  function render() {
    const dots = Array.from({ length: MAX_PIN }, (_, i) => {
      const filled = i < pin.length;
      return `<span class="pin-dot${filled ? " filled" : ""}" aria-hidden="true"></span>`;
    }).join("");

    const footnote = isMockMode()
      ? `<p class="login-footnote">Modo prueba: admin 1111, operador 2222, repartidor 3333</p>`
      : "";

    container.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <span class="brand-icon" aria-hidden="true">LMax</span>
          <div>
            <strong>LavaMax</strong>
            <small>Ingreso con PIN</small>
          </div>
        </div>
        <p class="login-hint">Ingresa el PIN asignado a tu usuario</p>
        <div class="pin-display" role="group" aria-label="PIN ingresado">
          ${dots}
        </div>
        <p class="login-error" id="login-error" hidden></p>
        <div class="pin-keypad" aria-label="Teclado numerico">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(
              (n) =>
                `<button type="button" class="pin-key" data-digit="${n}" ${
                  loading ? "disabled" : ""
                }>${n}</button>`
            )
            .join("")}
          <button type="button" class="pin-key pin-key-muted" data-action="clear" ${
            loading ? "disabled" : ""
          }>C</button>
          <button type="button" class="pin-key" data-digit="0" ${
            loading ? "disabled" : ""
          }>0</button>
          <button type="button" class="pin-key pin-key-enter" data-action="submit" ${
            loading || pin.length < 4 ? "disabled" : ""
          } aria-label="Ingresar">${loading ? "..." : "OK"}</button>
        </div>
        ${footnote}
      </div>`;

    container.querySelectorAll("[data-digit]").forEach((btn) => {
      btn.addEventListener("click", () => addDigit(btn.dataset.digit));
    });
    container.querySelector('[data-action="clear"]')?.addEventListener("click", clearPin);
    container.querySelector('[data-action="submit"]')?.addEventListener("click", submit);
  }

  function setError(msg) {
    const el = container.querySelector("#login-error");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function addDigit(d) {
    if (loading || pin.length >= MAX_PIN) return;
    pin += d;
    setError("");
    render();
    if (pin.length >= 4) {
      container.querySelector('[data-action="submit"]')?.focus();
    }
  }

  function clearPin() {
    if (loading) return;
    pin = "";
    setError("");
    render();
  }

  async function submit() {
    if (loading || pin.length < 4) return;
    loading = true;
    setError("");
    render();
    try {
      const { data } = await api.login(pin);
      if (!data?.id || !data?.rol) {
        throw new Error("Respuesta de login invalida");
      }
      const session = setSession(data);
      pin = "";
      loading = false;
      onSuccess(session);
    } catch (err) {
      pin = "";
      setError(err.message || "PIN incorrecto");
      loading = false;
      render();
    }
  }

  function onKeyDown(e) {
    if (loading) return;
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      addDigit(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      pin = pin.slice(0, -1);
      setError("");
      render();
    } else if (e.key === "Enter" && pin.length >= 4) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      clearPin();
    }
  }

  container.addEventListener("keydown", onKeyDown);
  render();

  return () => container.removeEventListener("keydown", onKeyDown);
}
