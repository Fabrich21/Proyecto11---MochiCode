export type IncidentRecord = {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  system: string;
  description: string;
  slaRemaining: number;
  slaPercentage: number;
  createdAt: string; // ISO
  affectedUsers?: number;
  affectedProject?: string;
  incidentStatus?: 'abierto' | 'en progreso' | 'resuelto' | 'cerrado';
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaTargetMinutes?: number | null;
};

const store: IncidentRecord[] = [];

export function listIncidents() {
  return store;
}

export function getIncident(id: string) {
  return store.find((i) => i.id === id) || null;
}

function genId() {
  return `INC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createIncident(payload: Partial<IncidentRecord>) {
  const now = new Date().toISOString();
  const record: IncidentRecord = {
    id: payload.id || genId(),
    severity: (payload.severity as IncidentRecord['severity']) || 'medium',
    system: payload.system || 'unknown',
    description: payload.description || '',
    slaRemaining: payload.slaRemaining ?? 0,
    slaPercentage: payload.slaPercentage ?? 0,
    createdAt: payload.createdAt || now,
    affectedUsers: payload.affectedUsers,
    affectedProject: payload.affectedProject,
    incidentStatus: payload.incidentStatus || 'abierto',
    acknowledgedAt: payload.acknowledgedAt ?? null,
    resolvedAt: payload.resolvedAt ?? null,
    closedAt: payload.closedAt ?? null,
    slaTargetMinutes: payload.slaTargetMinutes ?? null,
  };
  store.push(record);
  return record;
}

export function updateIncident(id: string, patch: Partial<IncidentRecord>) {
  const idx = store.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  store[idx] = { ...store[idx], ...patch };
  return store[idx];
}
