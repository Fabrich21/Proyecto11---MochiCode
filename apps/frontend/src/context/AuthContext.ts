"use client";

import { createContext } from "react";
import Keycloak from "keycloak-js";

export const AuthContext = createContext<Keycloak | null>(null);
