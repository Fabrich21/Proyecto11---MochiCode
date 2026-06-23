'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { IncidentCard } from './incident-card';
import { Incident } from './incident-types';
import IncidentDetailModal from './incident-detail-modal';
import SlaViewer from './sla-viewer';

import { IncidenteEstado } from './incident-types';
/*
const mockIncidents: Incident[] = [
  {
    id: 'INC-2024-0042',
    severity: 'critical',
    system: 'Pagos',
    description: 'Caída total del servicio de procesamiento de pagos. Base de datos no responde a queries.',
    slaRemaining: 15,
    slaPercentage: 25,
    createdAt: new Date(Date.now() - 45 * 60000),
    affectedUsers: 2400,
    affectedProject: 'pagos',
    incidentStatus: IncidenteEstado.ABIERTO,
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
    slaTargetMinutes: 60,
  },
  {
    id: 'INC-2024-0041',
    severity: 'high',
    system: 'Logística',
    description: 'Retrasos en actualización de rastreo de envíos. Latencia elevada en API.',
    slaRemaining: 35,
    slaPercentage: 58,
    createdAt: new Date(Date.now() - 22 * 60000),
    affectedUsers: 8900,
    affectedProject: 'logistica',
    incidentStatus: IncidenteEstado.EN_PROGRESO,
    acknowledgedAt: new Date(Date.now() - 20 * 60000),
    resolvedAt: null,
    closedAt: null,
    slaTargetMinutes: 120,
  },
  {
    id: 'INC-2024-0040',
    severity: 'high',
    system: 'API Gateway',
    description: '50% de requests retornando 503. Uno de los servidores está sobrecargado.',
    slaRemaining: 20,
    slaPercentage: 67,
    createdAt: new Date(Date.now() - 13 * 60000),
    affectedUsers: 5200,
    affectedProject: 'api-gateway',
    incidentStatus: IncidenteEstado.EN_PROGRESO,
    acknowledgedAt: new Date(Date.now() - 12 * 60000),
    resolvedAt: null,
    closedAt: null,
    slaTargetMinutes: 90,
  },
  {
    id: 'INC-2024-0039',
    severity: 'medium',
    system: 'Cache Redis',
    description: 'Degradación en performance del cache. Misses aumentaron a 45%.',
    slaRemaining: 85,
    slaPercentage: 85,
    createdAt: new Date(Date.now() - 8 * 60000),
  },
  {
    id: 'INC-2024-0038',
    severity: 'medium',
    system: 'Salud',
    description: 'Interrupción parcial en el servicio de consultas médicas.',
    slaRemaining: 60,
    slaPercentage: 40,
    createdAt: new Date(Date.now() - 90 * 60000),
    affectedUsers: 1200,
    affectedProject: 'salud',
    incidentStatus: IncidenteEstado.CERRADO, // replaced resuelto with CERRADO to match enum
    acknowledgedAt: new Date(Date.now() - 85 * 60000),
    resolvedAt: new Date(Date.now() - 30 * 60000),
    closedAt: null,
    slaTargetMinutes: 180,
  },
];
*/
export function IncidentDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);;

  useEffect(() => {
    if (!selectedIncident) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIncident(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIncident]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch('/api/incidents');
        if (!res.ok) throw new Error('fetch_failed');
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          setIncidents(data as Incident[]);
        }
      } catch (err) {
        console.error('[incidents] error:', err);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function updateIncident(updated: Incident) {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIncident(updated);

    // Optimistic persist to backend
    (async () => {
      try {
        await fetch(`/api/incidents/${encodeURIComponent(updated.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.error('[incidents] error:', err);
        // ignore network errors for now
      }
    })();
  }

  function handleAcknowledge(incident: Incident) {
    if (incident.acknowledgedAt) return;
    updateIncident({ ...incident, acknowledgedAt: new Date(), incidentStatus: incident.incidentStatus === IncidenteEstado.ABIERTO ? IncidenteEstado.EN_PROGRESO : incident.incidentStatus });
  }

  function handleResolve(incident: Incident) {
    if (incident.resolvedAt) return;
    updateIncident({ ...incident, resolvedAt: new Date(), incidentStatus: IncidenteEstado.CERRADO });
  }

  function handleCloseIncident(incident: Incident) {
    if (incident.closedAt) return;
    updateIncident({ ...incident, closedAt: new Date(), incidentStatus: IncidenteEstado.CERRADO });
  }

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesSearch = !q || [incident.id, incident.system, incident.description].some((s) => s.toLowerCase().includes(q));
      const matchesSeverity = !selectedSeverity || incident.severity === selectedSeverity;
      return matchesSearch && matchesSeverity;
    });
  }, [incidents, searchQuery, selectedSeverity]);

  const sortedIncidents = useMemo(() => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
    return [...filteredIncidents].sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity];
      if (sd !== 0) return sd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredIncidents]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5 shadow-sm">
          <Search className="h-5 w-5 text-foreground/40" />
          <input
            type="text"
            placeholder="Buscar incidentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder-foreground/40 outline-none"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedSeverity || ''}
            onChange={(e) => setSelectedSeverity(e.target.value || null)}
            className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 font-medium text-foreground transition-colors hover:bg-secondary/20 cursor-pointer"
          >
            <option value="">Todos</option>
            <option value="critical">Críticos</option>
            <option value="high">Altos</option>
            <option value="medium">Medios</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Total Incidentes</p>
          <p className="text-3xl font-bold text-accent mt-2">{incidents.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Críticos</p>
          <p className="text-3xl font-bold text-destructive mt-2">{incidents.filter((i) => i.severity === 'critical').length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Altos</p>
          <p className="text-3xl font-bold text-warning mt-2">{incidents.filter((i) => i.severity === 'high').length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Medios</p>
          <p className="text-3xl font-bold text-info mt-2">{incidents.filter((i) => i.severity === 'medium').length}</p>
        </div>
      </div>

      {/* SLA Viewer (compact) */}
      <div className="mt-2">
        <SlaViewer incidents={incidents} />
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Incidentes Activos</h2>
        <div className="space-y-3">
          {sortedIncidents.length > 0 ? (
            sortedIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} onClick={() => setSelectedIncident(incident)} />
            ))
          ) : (
            <div className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
              <p className="text-foreground/60">No hay incidentes que coincidan con los filtros</p>
            </div>
          )}
        </div>
      </div>

      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onCloseIncident={handleCloseIncident}
        />
      )}
    </div>
  );
}
