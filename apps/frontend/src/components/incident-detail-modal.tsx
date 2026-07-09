'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Check, Archive, Clock, Users, FileText, AlertTriangle, MessageSquare, Send, Lightbulb } from 'lucide-react';
import { Incident, IncidenteEstado, getIncidentStatusBadgeClassName, getIncidentStatusLabel, normalizeIncidentStatus } from './incident-types';
import { cn } from '@/lib/utils';
import { formatDate, formatNumberES } from '@/lib/format';
import { useAuth } from '@/context/useAuth';

interface Props {
  incident: Incident;
  onClose: () => void;
  onAcknowledge: (i: Incident) => void;
  onResolve: (i: Incident) => void;
  onCloseIncident: (i: Incident) => void;
}

interface Comentario {
  id: string;
  incidenteId: string;
  usuarioId: string;
  contenido: string;
  creadoEn: string;
}

function cleanDescription(desc: string): string {
  if (!desc) return 'Sin descripción';
  try {
    const jsonMatch = desc.match(/Payload original:\s*(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const payload = JSON.parse(jsonMatch[1]);
        const titulo = payload.titulo || payload.title || '';
        const descripcion = payload.descripcion || payload.description || '';
        const prefix = desc.split('Payload original:')[0].trim();
        return [prefix, titulo, descripcion].filter(Boolean).join(' — ');
      } catch {
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
  const keycloak = useAuth();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [comentariosLoading, setComentariosLoading] = useState(true);
  const [comentariosError, setComentariosError] = useState('');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [activeTab, setActiveTab] = useState<'detalles' | 'playbook'>('detalles');
  const [playbook, setPlaybook] = useState<string[]>([]);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookError, setPlaybookError] = useState('');

  const loadPlaybook = useCallback(async () => {
    if (playbook.length > 0 || playbookLoading) return;
    setPlaybookLoading(true);
    setPlaybookError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incident.id)}/playbook`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${keycloak?.token || ''}` },
      });
      if (!res.ok) throw new Error('No se pudo cargar el playbook');
      const data: unknown = await res.json();
      setPlaybook(Array.isArray(data) ? (data as string[]) : []);
    } catch (err) {
      setPlaybookError(err instanceof Error ? err.message : 'Error al cargar playbook');
    } finally {
      setPlaybookLoading(false);
    }
  }, [incident.id, keycloak?.token, playbook.length, playbookLoading]);

  useEffect(() => {
    if (activeTab === 'playbook') {
      void loadPlaybook();
    }
  }, [activeTab, loadPlaybook]);

  const loadComentarios = useCallback(async () => {
    setComentariosLoading(true);
    setComentariosError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incident.id)}/comentarios`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${keycloak?.token || ''}` },
      });
      if (!res.ok) throw new Error('No se pudieron cargar los comentarios');
      const data: unknown = await res.json();
      setComentarios(Array.isArray(data) ? (data as Comentario[]) : []);
    } catch (err) {
      setComentariosError(err instanceof Error ? err.message : 'Error al cargar comentarios');
    } finally {
      setComentariosLoading(false);
    }
  }, [incident.id, keycloak?.token]);

  useEffect(() => {
    void loadComentarios();
  }, [loadComentarios]);

  async function handleEnviarComentario() {
    const contenido = nuevoComentario.trim();
    if (!contenido || enviando) return;
    setEnviando(true);
    setComentariosError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incident.id)}/comentarios`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'No se pudo agregar el comentario');
      }
      const creado: Comentario = await res.json();
      setComentarios((prev) => [...prev, creado]);
      setNuevoComentario('');
    } catch (err) {
      setComentariosError(err instanceof Error ? err.message : 'Error al enviar comentario');
    } finally {
      setEnviando(false);
    }
  }

  const currentStatus = normalizeIncidentStatus(incident.incidentStatus);
  const isClosed = currentStatus === IncidenteEstado.CERRADO || !!incident.closedAt;
  const isResolved = !!incident.resolvedAt;
  const isAcknowledged = !!incident.acknowledgedAt;
  const cleanDesc = cleanDescription(incident.description);
  const statusLabel = getIncidentStatusLabel(incident.incidentStatus);
  const statusClassName = getIncidentStatusBadgeClassName(incident.incidentStatus);

  const timeline = [
    { label: 'Creado', value: incident.createdAt, icon: <FileText className="h-4 w-4" /> },
    { label: 'Reconocido', value: incident.acknowledgedAt, icon: <Check className="h-4 w-4" /> },
    { label: 'Resuelto', value: incident.resolvedAt, icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Cerrado', value: incident.closedAt, icon: <Archive className="h-4 w-4" /> },
  ].filter((item) => Boolean(item.value));

  const alertPayloadText = typeof incident.alertPayload === 'string'
    ? incident.alertPayload
    : incident.alertPayload
      ? JSON.stringify(incident.alertPayload, null, 2)
      : '';

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
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', statusClassName)}>
                  {statusLabel}
                </span>
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
          <div className="mt-4 flex gap-4 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('detalles')}
              className={cn(
                'pb-2 text-sm font-medium transition-colors relative',
                activeTab === 'detalles' ? 'text-foreground' : 'text-foreground/50 hover:text-foreground/80'
              )}
            >
              Detalles y Comentarios
              {activeTab === 'detalles' && (
                <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-primary rounded-t-md" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('playbook')}
              className={cn(
                'pb-2 text-sm font-medium transition-colors relative flex items-center gap-2',
                activeTab === 'playbook' ? 'text-foreground' : 'text-foreground/50 hover:text-foreground/80'
              )}
            >
              <Lightbulb className="h-4 w-4" /> Playbook
              {activeTab === 'playbook' && (
                <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-primary rounded-t-md" />
              )}
            </button>
          </div>
        </header>

        <div className="space-y-6 px-6 py-5">
          {activeTab === 'detalles' ? (
            <>
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
            {incident.externalSource && (
              <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
                Fuente: {incident.externalSource}
              </span>
            )}
            {incident.externalId && (
              <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
                ID externo: {incident.externalId}
              </span>
            )}
          </div>

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
                  {isResolved ? 'Caso resuelto y cerrado correctamente.' : 'Caso cerrado correctamente.'}
                </p>
                <p className="mt-2 text-green-900/80">
                  {incident.resolutionSummary || cleanDesc || 'No se registró una solución detallada.'}
                </p>
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Línea de tiempo</p>
              <div className="mt-2 space-y-2">
                {timeline.map((entry) => (
                  <div key={entry.label} className="flex items-start gap-3 rounded-lg border border-border bg-white px-4 py-3">
                    <div className="mt-0.5 text-foreground/50">{entry.icon}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <p className="text-xs text-foreground/60">{formatDate(entry.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {incident.alertPayload && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Payload de alerta</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-secondary/10 p-4 text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {alertPayloadText}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card title="SLA restante" value={`${incident.slaRemaining}m`} />
            <Card title="SLA consumido" value={`${incident.slaPercentage}%`} />
            <Card title="Usuarios afectados" value={incident.affectedUsers ? formatNumberES(incident.affectedUsers) : 'No reportado'} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock icon={<Clock className="h-4 w-4" />} label="Creado" value={formatDate(incident.createdAt)} />
            <InfoBlock icon={<Users className="h-4 w-4" />} label="ID del incidente" value={incident.id} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="Sistema afectado" value={incident.affectedProject || incident.system || 'No reportado'} />
            <InfoBlock label="Estado" value={statusLabel} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoBlock label="Reconocido" value={formatDate(incident.acknowledgedAt)} />
            <InfoBlock label="Resuelto" value={formatDate(incident.resolvedAt)} />
            <InfoBlock label="Cerrado" value={formatDate(incident.closedAt)} />
          </div>

          {incident.slaTargetMinutes && (
            <InfoBlock label="SLA minutos previstos" value={`${incident.slaTargetMinutes} min`} />
          )}

          {/* Comentarios */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-foreground/60" />
              <p className="text-sm font-semibold text-foreground/70">
                Comentarios{comentarios.length > 0 ? ` (${comentarios.length})` : ''}
              </p>
            </div>

            {comentariosError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {comentariosError}
              </div>
            )}

            <div className="space-y-2">
              {comentariosLoading && (
                <p className="text-sm text-foreground/50">Cargando comentarios...</p>
              )}
              {!comentariosLoading && comentarios.length === 0 && (
                <p className="rounded-lg border border-border bg-secondary/10 px-4 py-3 text-sm text-foreground/60">
                  Aún no hay comentarios en este incidente.
                </p>
              )}
              {!comentariosLoading && comentarios.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-foreground/80">{c.usuarioId}</span>
                    <span className="text-xs text-foreground/50">{formatDate(c.creadoEn)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{c.contenido}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleEnviarComentario();
                  }
                }}
                placeholder="Escribe un comentario... (Ctrl+Enter para enviar)"
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
              />
              <button
                type="button"
                onClick={() => void handleEnviarComentario()}
                disabled={enviando || !nuevoComentario.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-[#3C6E71] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#2d5558] disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </>
        ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h4 className="text-lg font-bold text-foreground">Playbook de Resolución</h4>
              </div>
              <p className="text-sm text-foreground/70 mb-4">
                Estos son los pasos sugeridos por el motor inteligente para mitigar este tipo de incidente:
              </p>

              {playbookError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {playbookError}
                </div>
              )}

              {playbookLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-secondary/20" />
                  ))}
                </div>
              ) : playbook.length === 0 && !playbookError ? (
                <p className="rounded-lg border border-border bg-secondary/10 px-4 py-3 text-sm text-foreground/60">
                  No hay un playbook disponible para este incidente.
                </p>
              ) : (
                <div className="space-y-3">
                  {playbook.map((paso, index) => {
                    const isStep = paso.toLowerCase().startsWith('paso');
                    return (
                      <div key={index} className="flex items-start gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
                        {isStep ? (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </div>
                        ) : (
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <p className="text-sm font-medium leading-relaxed text-foreground">{paso}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 flex-wrap">
          {!isClosed && (
            <>
              <button
                type="button"
                onClick={() => onAcknowledge(incident)}
                disabled={isAcknowledged}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition disabled:opacity-50 hover:bg-secondary/20"
              >
                <Check className="h-4 w-4" /> Reconocer
              </button>

              <button
                type="button"
                onClick={() => onResolve(incident)}
                disabled={isResolved}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-emerald-50 px-3 py-2 text-sm font-medium transition disabled:opacity-50 hover:bg-emerald-100"
              >
                <Check className="h-4 w-4" /> Marcar resuelto
              </button>

              <button
                type="button"
                onClick={() => onCloseIncident(incident)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-destructive/10 px-3 py-2 text-sm font-medium transition text-red-700 hover:bg-destructive/20"
              >
                <Archive className="h-4 w-4" /> Cerrar incidente
              </button>
            </>
          )}

          {isClosed && (
            <span className="text-sm text-gray-500 font-medium">
              ✓ Incidente cerrado — {formatDate(incident.closedAt)}
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