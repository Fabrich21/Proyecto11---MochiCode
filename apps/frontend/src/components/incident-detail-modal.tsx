'use client';

import React from 'react';
import { X, Check, CheckCircle, Archive, Clock, Users } from 'lucide-react';
import { Incident, IncidenteEstado } from './incident-types';
import { cn } from '@/lib/utils';
import { formatDate, formatNumberES } from '@/lib/format';

interface Props {
  incident: Incident;
  onClose: () => void;
  onAcknowledge: (i: Incident) => void;
  onResolve: (i: Incident) => void;
  onCloseIncident: (i: Incident) => void;
}

// Limpia la descripción si viene como JSON del backend
function cleanDescription(desc: string): string {
  if (!desc) return 'Sin descripción';
  try {
    //extraer solo el título
    const jsonMatch = desc.match(/Payload original:\s*(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[1]);
        const titulo = payload.titulo || payload.title || '';
        const descripcion = payload.descripcion || payload.description || '';
        const prefix = desc.split('Payload original:')[0].trim();
        return [prefix, titulo, descripcion].filter(Boolean).join(' — ');
      } catch {
        // Si no se puede parsear, quitar el bloque de payload
        return desc.split('Payload original:')[0].trim();
      }
    }
    return desc;
  } catch {
    return desc;
  }
}

function getSeverityLabel(severity: string) {
  switch (severity) {
    case 'critical': return 'Crítico';
    case 'high': return 'Alto';
    case 'medium': return 'Medio';
    default: return severity;
  }
}

export function IncidentDetailModal({ incident, onClose, onAcknowledge, onResolve, onCloseIncident }: Props) {
  const isClosed = incident.incidentStatus === IncidenteEstado.CERRADO || !!incident.closedAt;
  const isResolved = !!incident.resolvedAt;
  const isAcknowledged = !!incident.acknowledgedAt;
  const cleanDesc = cleanDescription(incident.description);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 animate-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="incident-detail-title"
        aria-modal="true"
        role="dialog"
      >
        <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs uppercase tracking-wide text-foreground/50">Detalle de incidente</p>
                {isClosed && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-300">
                    Cerrado
                  </span>
                )}
                {!isClosed && isAcknowledged && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300">
                    En Progreso
                  </span>
                )}
                {!isClosed && !isAcknowledged && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                    Sin reconocer
                  </span>
                )}
              </div>
              <h3 id="incident-detail-title" className="mt-1 text-xl font-bold text-foreground">
                {incident.title || incident.system || incident.id}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border p-2 text-foreground/70 transition hover:bg-secondary/20 hover:text-foreground"
              aria-label="Cerrar detalle del incidente"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold',
              incident.severity === 'critical' ? 'text-[#E94B3C] border-[#E94B3C]' :
              incident.severity === 'high' ? 'text-[#F59E0B] border-[#F59E0B]' : 'text-[#3B82F6] border-[#3B82F6]'
            )}>
              Severidad: {getSeverityLabel(incident.severity)}
            </span>
            <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
              Sistema: {incident.system}
            </span>
          </div>

          {/* Descripción limpia */}
          <div>
            <p className="text-sm font-semibold text-foreground/70">Descripción</p>
            <p className="mt-2 rounded-lg border border-border bg-secondary/10 p-4 text-sm leading-relaxed text-foreground">
              {cleanDesc}
            </p>
          </div>

          {isClosed && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Solución / cierre</p>
              <div className="mt-2 rounded-lg border border-border bg-green-50/70 p-4 text-sm leading-relaxed text-foreground">
                <p className="font-medium text-green-900">
                  Caso cerrado correctamente.
                </p>
                <p className="mt-2 text-green-900/80">
                  {incident.resolutionSummary || cleanDesc || 'No se registró una solución detallada en el incidente.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card title="SLA restante" value={`${incident.slaRemaining}m`} />
            <Card title="SLA consumido" value={`${incident.slaPercentage}%`} />
            <Card title="Usuarios afectados" value={incident.affectedUsers ? formatNumberES(incident.affectedUsers) : 'No reportado'} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock icon={<Clock className="h-4 w-4" />} label="Creado" value={formatDate(incident.createdAt as any)} />
            <InfoBlock icon={<Users className="h-4 w-4" />} label="ID del incidente" value={incident.id} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="Sistema afectado" value={incident.affectedProject || incident.system || 'No reportado'} />
            <InfoBlock label="Estado" value={incident.incidentStatus || 'No reportado'} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoBlock label="Reconocido" value={formatDate(incident.acknowledgedAt as any)} />
            <InfoBlock label="Resuelto" value={formatDate(incident.resolvedAt as any)} />
            <InfoBlock label="Cerrado" value={formatDate(incident.closedAt as any)} />
          </div>

          {incident.slaTargetMinutes && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBlock label="SLA minutos previstos" value={`${incident.slaTargetMinutes} min`} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          {!isClosed && (
            <>
              <button
                type="button"
                onClick={() => onAcknowledge(incident)}
                disabled={isAcknowledged}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Reconocer
              </button>

              <button
                type="button"
                onClick={() => onCloseIncident(incident)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-destructive/10 px-3 py-2 text-sm font-medium transition text-red-700"
              >
                <Archive className="h-4 w-4" /> Cerrar incidente
              </button>
            </>
          )}

          {isClosed && (
            <span className="text-sm text-gray-500 font-medium">
              ✓ Incidente cerrado — {formatDate(incident.closedAt as any)}
            </span>
          )}
        </footer>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">{title}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/10 px-4 py-3 text-sm text-foreground/80">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}:</span>
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default IncidentDetailModal;