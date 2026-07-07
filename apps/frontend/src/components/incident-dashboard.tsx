'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { IncidentCard } from './incident-card';
import { Incident } from './incident-types';
import IncidentDetailModal from './incident-detail-modal';
import SlaViewer from './sla-viewer';
import { NewIncidentModal } from './new-incident-modal';
import { useWebSockets } from '../hooks/useWebSockets';
import { IncidenteEstado } from './incident-types';

function mapBackendIncident(backendIncidente: any): Incident {
  const prioridadMap: Record<string, string> = {
    CRITICA: 'critical',
    ALTA: 'high',
    MEDIA: 'medium',
    BAJA: 'medium',
  };

  let slaRemaining = 0;
  let slaPercentage = 0;
  let slaTargetMinutes = 60;

  const limiteSla = backendIncidente.fechaLimiteResolucion || backendIncidente.fecha_limite_resolucion;
  if (limiteSla) {
    const now = new Date();
    const limite = new Date(limiteSla);
    slaRemaining = Math.max(0, Math.round((limite.getTime() - now.getTime()) / 60000));
    if (backendIncidente.politicaSla?.tiempoMaximoResolucionMinutos) {
      slaTargetMinutes = backendIncidente.politicaSla.tiempoMaximoResolucionMinutos;
    }
    const elapsedMinutes = slaTargetMinutes - slaRemaining;
    slaPercentage = Math.round((elapsedMinutes / slaTargetMinutes) * 100);
    slaPercentage = Math.min(100, Math.max(0, slaPercentage));
  }

  return {
    id: backendIncidente.id,
    title: backendIncidente.titulo || `Incidente ${backendIncidente.id}`,
    severity: (prioridadMap[backendIncidente.prioridad] || 'medium') as any,
    system: backendIncidente.sistemaId || backendIncidente.sistema_id || 'Desconocido',
    description: backendIncidente.descripcion || backendIncidente.titulo || 'Sin descripción',
    slaRemaining,
    slaPercentage,
    createdAt: backendIncidente.creadoEn || new Date(),
    incidentStatus: backendIncidente.estado || IncidenteEstado.ABIERTO,
    slaTargetMinutes,
    affectedProject: backendIncidente.sistemaId ?? null,
    affectedUsers: backendIncidente.affectedUsers ?? null,
    acknowledgedAt: backendIncidente.acknowledgedAt ?? null,
    resolvedAt: backendIncidente.fechaResolucion ?? null,
    closedAt: backendIncidente.estado === 'CERRADO' ? (backendIncidente.fechaResolucion ?? new Date().toISOString()) : null,
  };
}

export function IncidentDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const { isConnected } = useWebSockets({
    room: 'dashboard_incidentes',
    onNuevoIncidente: (incidenteBackend) => {
      const newIncident = mapBackendIncident(incidenteBackend);
      setIncidents((prev) => [newIncident, ...prev]);
    },
    onEstadoActualizado: ({ incidenteId, nuevoEstado }) => {
      setIncidents((prev) =>
        prev.map((i) => (i.id === incidenteId ? { ...i, incidentStatus: nuevoEstado } : i))
      );
    },
    onIncidenteActualizado: ({ incidenteId }: { incidenteId: string; nuevo_evento: any }) => {
      console.log('Incidente actualizado vía WS:', incidenteId);
    },
  });

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

  async function loadIncidents() {
    try {
      const res = await fetch('/api/incidents');
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.data ?? []);
      setIncidents(items as Incident[]);
    } catch (err) {
      console.error('[incidents] error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncidents();
  }, []);

  function updateIncident(updated: Incident) {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIncident(updated);
    (async () => {
      try {
        await fetch(`/api/incidents/${encodeURIComponent(updated.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (err) {
        console.error('[incidents] patch error:', err);
      }
    })();
  }

  function handleAcknowledge(incident: Incident) {
    if (incident.acknowledgedAt) return;
    updateIncident({
      ...incident,
      acknowledgedAt: new Date(),
      incidentStatus: incident.incidentStatus === IncidenteEstado.ABIERTO
        ? IncidenteEstado.EN_PROGRESO
        : incident.incidentStatus,
    });
  }

  function handleResolve(incident: Incident) {
    if (incident.resolvedAt) return;
    updateIncident({ ...incident, resolvedAt: new Date(), incidentStatus: IncidenteEstado.CERRADO });
  }

  function handleCloseIncident(incident: Incident) {
    if (incident.closedAt) return;
    updateIncident({ ...incident, closedAt: new Date(), incidentStatus: IncidenteEstado.CERRADO });
  }

  function handleIncidentCreated() {
    // Recargar lista tras crear incidente
    setLoading(true);
    loadIncidents();
  }

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesSearch = !q || [incident.id, incident.system, incident.description, incident.title ?? '']
        .some((s) => s.toLowerCase().includes(q));
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
            className="rounded-lg border border-border bg-white px-4 py-2 font-medium text-foreground transition-colors hover:bg-secondary/20 cursor-pointer"
          >
            <option value="">Todos</option>
            <option value="critical">Críticos</option>
            <option value="high">Altos</option>
            <option value="medium">Medios</option>
          </select>

          <div className="flex items-center gap-2 px-3 rounded-lg border border-border bg-white shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-sm font-medium text-foreground/70">
              {isConnected ? 'Live' : 'Desconectado'}
            </span>
          </div>

          {/* Botón Nuevo Incidente */}
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3C6E71] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2d5558] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo incidente
          </button>
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

      {/* SLA Viewer */}
      <div className="mt-2">
        <SlaViewer incidents={incidents} />
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Incidentes</h2>
          <span className="text-sm text-foreground/50">{sortedIncidents.length} resultado{sortedIncidents.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
              <p className="text-foreground/60">Cargando incidentes...</p>
            </div>
          ) : sortedIncidents.length > 0 ? (
            sortedIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} onClick={() => setSelectedIncident(incident)} />
            ))
          ) : (
            <div className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
              <p className="text-foreground/60">No hay incidentes registrados</p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#3C6E71] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2d5558] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Registrar primer incidente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          onCloseIncident={handleCloseIncident}
        />
      )}

      {/* Modal nuevo incidente */}
      {showNewModal && (
        <NewIncidentModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleIncidentCreated}
        />
      )}
    </div>
  );
}