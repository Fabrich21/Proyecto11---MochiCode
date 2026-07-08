'use client';
import { useState, useMemo, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { IncidentCard } from './incident-card';
import { Incident, IncidenteEstado, normalizeIncidentStatus } from './incident-types';
import IncidentDetailModal from './incident-detail-modal';
import SlaViewer from './sla-viewer';
import { NewIncidentModal } from './new-incident-modal';
import { useWebSockets } from '../hooks/useWebSockets';
import { useAuth } from '../context/useAuth';

type BackendIncident = {
  id: string;
  titulo?: string;
  prioridad?: string;
  priority?: string;
  severity?: string;
  sistemaId?: string;
  sistema_id?: string;
  descripcion?: string;
  creadoEn?: string | Date;
  estado?: string;
  fechaResolucion?: string | Date | null;
  fechaLimiteResolucion?: string | Date | null;
  fecha_limite_resolucion?: string | Date | null;
  politicaSla?: {
    tiempoMaximoResolucionMinutos?: number;
  } | null;
  affectedUsers?: number | null;
  acknowledgedAt?: string | Date | null;
  resolutionSummary?: string | null;
  resolucion?: string | null;
  solucion?: string | null;
  solution?: string | null;
  externalId?: string;
  external_id?: string;
  externalSource?: string;
  external_source?: string;
  alertPayload?: Record<string, unknown> | string | null;
  alert_payload?: Record<string, unknown> | string | null;
  eventType?: 'created' | 'resolved' | 'updated';
  event_type?: 'created' | 'resolved' | 'updated';
  detectedAt?: string | Date | null;
  detected_at?: string | Date | null;
};

function mapSeverity(value?: string): Incident['severity'] {
  const normalized = String(value ?? 'MEDIA').toUpperCase();

  if (normalized === 'CRITICA' || normalized === 'CRITICAL' || normalized === 'URGENTE') {
    return 'critical';
  }

  if (normalized === 'ALTA' || normalized === 'HIGH') {
    return 'high';
  }

  return 'medium';
}

function mapBackendIncident(backendIncidente: BackendIncident): Incident {
  const prioridadMap: Record<string, string> = {
    CRITICA: 'critical',
    ALTA: 'high',
    MEDIA: 'medium',
    BAJA: 'medium',
  };

  const prioridadNormalizada = String(backendIncidente.prioridad ?? backendIncidente.priority ?? backendIncidente.severity ?? 'MEDIA').toUpperCase();

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
    severity: mapSeverity(prioridadMap[prioridadNormalizada] || prioridadNormalizada),
    system: backendIncidente.sistemaId || backendIncidente.sistema_id || 'Desconocido',
    description: backendIncidente.descripcion || backendIncidente.titulo || 'Sin descripción',
    resolutionSummary: backendIncidente.resolutionSummary || backendIncidente.resolucion || backendIncidente.solucion || backendIncidente.solution || null,
    slaRemaining,
    slaPercentage,
    createdAt: backendIncidente.creadoEn || new Date(),
    incidentStatus: backendIncidente.estado || IncidenteEstado.ABIERTO,
    slaTargetMinutes,
    affectedProject: backendIncidente.sistemaId ?? undefined,
    affectedUsers: backendIncidente.affectedUsers ?? undefined,
    acknowledgedAt: backendIncidente.acknowledgedAt ?? null,
    resolvedAt: backendIncidente.fechaResolucion ?? null,
    closedAt: backendIncidente.estado === 'CERRADO' ? (backendIncidente.fechaResolucion ?? new Date().toISOString()) : null,
    externalId: backendIncidente.externalId || backendIncidente.external_id || undefined,
    externalSource: backendIncidente.externalSource || backendIncidente.external_source || undefined,
    alertPayload: backendIncidente.alertPayload || backendIncidente.alert_payload || null,
    eventType: backendIncidente.eventType || backendIncidente.event_type || undefined,
    detectedAt: backendIncidente.detectedAt || backendIncidente.detected_at || backendIncidente.creadoEn || null,
  };
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'closed', label: 'Cerrados' },
  { value: 'critical', label: 'Críticos' },
  { value: 'high', label: 'Altos' },
  { value: 'medium', label: 'Medios' },
  { value: 'resolved', label: 'Resueltos' },
] as const;

type FilterOption = typeof FILTER_OPTIONS[number]['value'];

export function IncidentDashboard() {
  const keycloak = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('all'); 
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
    onIncidenteActualizado: ({ incidenteId }: { incidenteId: string; nuevo_evento?: unknown }) => {
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
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/v1/incidentes', {
        headers: {
          'Authorization': `Bearer ${keycloak?.token || ''}`
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`fetch_failed: ${res.status} - ${text}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.data ?? []);
      setIncidents(items as Incident[]);
    } catch (err: any) {
      console.error('[incidents] error:', err);
      setErrorMsg(err.message || 'Error desconocido al cargar incidentes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIncidents();
  }, [keycloak?.token]);

  function updateIncident(updated: Incident) {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIncident(updated);
    (async () => {
      try {
        await fetch(`/api/v1/incidentes/${encodeURIComponent(updated.id)}`, {
          method: 'PATCH',
          headers: { 
            'content-type': 'application/json',
            'Authorization': `Bearer ${keycloak?.token || ''}`
          },
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
    updateIncident({ ...incident, resolvedAt: new Date(), incidentStatus: IncidenteEstado.RESUELTO });
  }

  function handleCloseIncident(incident: Incident) {
    if (incident.closedAt) return;
    updateIncident({ ...incident, closedAt: new Date(), incidentStatus: IncidenteEstado.CERRADO });
  }

  function handleIncidentCreated() {
    setLoading(true);
    loadIncidents();
  }

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    return incidents.filter((incident) => {
      const matchesSearch = !q || [incident.id, incident.system, incident.description, incident.title ?? '']
        .some((s) => s.toLowerCase().includes(q));
      
      if (!matchesSearch) return false;
      
      const normalizedStatus = normalizeIncidentStatus(incident.incidentStatus);
      const isClosed = normalizedStatus === IncidenteEstado.CERRADO;
      const isResolved = normalizedStatus === IncidenteEstado.RESUELTO;
      
      switch (filterOption) {
        case 'all':
          return true;
        case 'open':
          return !isClosed;
        case 'closed':
          return isClosed;
        case 'critical':
          return incident.severity === 'critical';
        case 'high':
          return incident.severity === 'high';
        case 'medium':
          return incident.severity === 'medium';
        case 'resolved':
          return isResolved;
        default:
          return true;
      }
    });
  }, [incidents, searchQuery, filterOption]);

  const sortedIncidents = useMemo(() => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
    return [...filteredIncidents].sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity];
      if (sd !== 0) return sd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredIncidents]);

  const totalPages = Math.max(1, Math.ceil(sortedIncidents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedIncidents = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedIncidents.slice(start, start + pageSize);
  }, [sortedIncidents, safeCurrentPage]);

  const visiblePages = useMemo(() => {
    const pages: Array<number | 'ellipsis'> = [];
    const windowSize = 2;
    const start = Math.max(1, safeCurrentPage - windowSize);
    const end = Math.min(totalPages, safeCurrentPage + windowSize);

    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push('ellipsis');
      }
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }
      pages.push(totalPages);
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent text-foreground placeholder-foreground/40 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          
          <select
            value={filterOption}
            onChange={(e) => {
              setFilterOption(e.target.value as FilterOption);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-white px-4 py-2 font-medium text-foreground transition-colors hover:bg-secondary/20 cursor-pointer min-w-[160px]"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
          ) : errorMsg ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-8 text-center shadow-sm">
              <p className="font-semibold text-destructive">Error al cargar incidentes</p>
              <p className="mt-2 text-sm text-destructive/80">{errorMsg}</p>
            </div>
          ) : paginatedIncidents.length > 0 ? (
            paginatedIncidents.map((incident) => (
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

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-foreground/60">
              Página {safeCurrentPage} de {totalPages}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                &lt;
              </button>

              {visiblePages.map((page, index) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-foreground/40">...</span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-9 rounded-md border px-3 py-1.5 text-sm font-medium ${
                      page === safeCurrentPage
                        ? 'border-[#3C6E71] bg-[#3C6E71] text-white'
                        : 'border-border text-foreground/70 hover:bg-secondary/20'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
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