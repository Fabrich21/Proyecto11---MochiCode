"use client";

import { AuthContext } from "./AuthContext";
import Keycloak from "keycloak-js";
import React, { useEffect, useState, useRef } from "react";
import keycloakInstance from "../lib/keycloak";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const isRun = useRef(false);

  useEffect(() => {
    if (!keycloakInstance) {
      setIsInitializing(false);
      return;
    }
    
    if (isRun.current) return;
    isRun.current = true;

    keycloakInstance
      .init({ 
        onLoad: "login-required",
        checkLoginIframe: false // Evita errores de cookies de terceros en localhost
      })
      .then((auth) => {
        setAuthenticated(auth);
        setIsInitializing(false);
      })
      .catch((e) => {
        console.error("Fallo la inicialización de Keycloak:", e);
        setIsInitializing(false);
      });
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Redirigiendo al inicio de sesión seguro (P12)...</p>
      </div>
    );
  }

  // Si no está inicializando pero no está autenticado,
  // Keycloak ya debería estar redirigiendo, pero podemos renderizar null o un mensaje.
  if (!authenticated) {
    return null;
  }

  return (
    <AuthContext.Provider value={keycloakInstance}>
      {children}
    </AuthContext.Provider>
  );
}
