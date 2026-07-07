"use client";

import Keycloak from "keycloak-js";

// Solo inicializar Keycloak si estamos en el navegador
const keycloak = typeof window !== "undefined"
  ? new Keycloak({
      url: "https://underarm-those-stardust.ngrok-free.dev",
      realm: "sistema-centralizado",
      clientId: "p11",
    })
  : null;

export default keycloak;
