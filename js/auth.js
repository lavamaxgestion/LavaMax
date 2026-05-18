const SESSION_KEY = "lavarent_session";

export const ROLE_LABELS = {
  admin: "Administrador",
  operador: "Operador",
  repartidor: "Repartidor",
};

/** Rutas permitidas por rol (admin = todas). */
const ROUTES_BY_ROLE = {
  operador: ["/", "/nueva", "/pagos"],
  repartidor: ["/entregas", "/pagos"],
};

export const DEFAULT_ROUTE_BY_ROLE = {
  admin: "/",
  operador: "/",
  repartidor: "/entregas",
};

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.id || !session?.rol) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSession(user) {
  const session = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    loggedAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDefaultRoute(rol) {
  return DEFAULT_ROUTE_BY_ROLE[rol] || "/";
}

export function canAccessRoute(route, rol) {
  if (!rol) return false;
  if (rol === "admin") return true;
  const allowed = ROUTES_BY_ROLE[rol];
  return allowed?.includes(route) ?? false;
}

export function applyNavForRole(rol) {
  document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
    const roles = (link.dataset.roles || "").trim().split(/\s+/).filter(Boolean);
    const visible = roles.includes(rol);
    link.hidden = !visible;
  });

  const adminSection = document.querySelector(".nav-section[data-roles]");
  if (adminSection) {
    adminSection.hidden = rol !== "admin";
  }

  const btnApi = document.getElementById("btn-config-api");
  if (btnApi) btnApi.hidden = rol !== "admin";

  const sessionUser = document.getElementById("session-user");
  const session = getSession();
  if (sessionUser && session) {
    sessionUser.hidden = false;
    sessionUser.querySelector(".session-name").textContent = session.nombre;
    sessionUser.querySelector(".session-role").textContent =
      ROLE_LABELS[session.rol] || session.rol;
  }
}
