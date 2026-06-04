'use client';

import React from 'react';
import { X, Check, CheckCircle, Archive, Clock, Users } from 'lucide-react';
import { Incident } from './incident-types';
import { cn } from '@/lib/utils';
import { formatDate, formatNumberES } from '@/lib/format';

interface Props {
  incident: Incident;
  onClose: () => void;
  onAcknowledge: (i: Incident) => void;
  onResolve: (i: Incident) => void;
  onCloseIncident: (i: Incident) => void;
}

export function IncidentDetailModal({ incident, onClose, onAcknowledge, onResolve, onCloseIncident }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 animate-fade-in" role="presentation" onClick={onClose}>
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="incident-detail-title"
        aria-modal="true"
        role="dialog"
      >
        <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">Detalle de incidente</p>
              <h3 id="incident-detail-title" className="mt-1 text-xl font-bold text-foreground">
                {incident.id}
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
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', incident.severity === 'critical' ? 'text-[#E94B3C]' : incident.severity === 'high' ? 'text-[#F59E0B]' : 'text-[#3B82F6]')}>
              Severidad: {incident.severity}
            </span>
            <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
              Sistema: {incident.system}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground/70">Descripcion</p>
            <p className="mt-2 rounded-lg border border-border bg-secondary/10 p-4 text-sm leading-relaxed text-foreground">
              {incident.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card title="SLA restante" value={`${incident.slaRemaining}m`} />
            <Card title="SLA consumido" value={`${incident.slaPercentage}%`} />
            <Card title="Usuarios afectados" value={incident.affectedUsers ? formatNumberES(incident.affectedUsers) : 'No reportado'} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock icon={<Clock className="h-4 w-4" />} label="created_at" value={formatDate(incident.createdAt as any)} />
            <InfoBlock icon={<Users className="h-4 w-4" />} label="incident_id" value={incident.id} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="affected_project" value={incident.affectedProject || 'No reportado'} />
            <InfoBlock label="incident_status" value={incident.incidentStatus || 'No reportado'} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoBlock label="acknowledged_at" value={formatDate(incident.acknowledgedAt as any)} />
            <InfoBlock label="resolved_at" value={formatDate(incident.resolvedAt as any)} />
            <InfoBlock label="closed_at" value={formatDate(incident.closedAt as any)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="sla_target_minutes" value={incident.slaTargetMinutes ?? 'No definido'} />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => onAcknowledge(incident)}
            disabled={!!incident.acknowledgedAt}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Acknowledge
          </button>

          <button
            type="button"
            onClick={() => onResolve(incident)}
            disabled={!!incident.resolvedAt}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-success/10 px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" /> Resolve
          </button>

          <button
            type="button"
            onClick={() => onCloseIncident(incident)}
            disabled={!!incident.closedAt}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-destructive/10 px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <Archive className="h-4 w-4" /> Close
          </button>
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
