'use client';

import { useState, useMemo } from 'react';
import { Bell, Search, Filter, AlertTriangle, Plus } from 'lucide-react';
import { IncidentCard, Incident } from './incident-card';
import { ReportIncidentDialog, IncidentFormData } from './report-incident-dialog';
import { cn } from '@/lib/utils';

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
];

export function IncidentDashboard() {
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const matchesSearch =
        incident.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.system.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = !selectedSeverity || incident.severity === selectedSeverity;

      return matchesSearch && matchesSeverity;
    });
  }, [incidents, searchQuery, selectedSeverity]);

  const sortedIncidents = useMemo(() => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return [...filteredIncidents].sort((a, b) => {
      const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [filteredIncidents]);

  const handleReportIncident = (formData: IncidentFormData) => {
    const newIncident: Incident = {
      id: `INC-2024-${String(incidents.length + 1).padStart(4, '0')}`,
      severity: formData.severity,
      system: formData.system,
      description: formData.description,
      slaRemaining: 60,
      slaPercentage: 100,
      createdAt: new Date(),
      affectedUsers: 0,
    };
    setIncidents([newIncident, ...incidents]);
    setIsReportDialogOpen(false);
  };

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

          <button
            onClick={() => setIsReportDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Reportar Incidente
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
          <p className="text-3xl font-bold text-destructive mt-2">
            {incidents.filter(i => i.severity === 'critical').length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Altos</p>
          <p className="text-3xl font-bold text-warning mt-2">
            {incidents.filter(i => i.severity === 'high').length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm hover:shadow-md transition">
          <p className="text-sm font-medium text-foreground/60">Medios</p>
          <p className="text-3xl font-bold text-info mt-2">
            {incidents.filter(i => i.severity === 'medium').length}
          </p>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Incidentes Activos</h2>
        <div className="space-y-3">
          {sortedIncidents.length > 0 ? (
            sortedIncidents.map(incident => (
              <IncidentCard key={incident.id} incident={incident} />
            ))
          ) : (
            <div className="rounded-lg border border-border bg-white p-8 text-center shadow-sm">
              <p className="text-foreground/60">No hay incidentes que coincidan con los filtros</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Dialog */}
      <ReportIncidentDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        onSubmit={handleReportIncident}
      />
    </div>
  );
}
