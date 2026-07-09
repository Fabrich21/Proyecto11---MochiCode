'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Check, Archive, Clock, Users, FileText, AlertTriangle, MessageSquare, Send } from 'lucide-react';
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

// Limpia la descripción si viene como JSON del backend
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

  const loadComentarios = useCallback(async () => {
    setComentariosLoading(true);
    setComentariosError('');
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incident.id)}/comentarios`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${keycloak?.token || ''}` },
      });
      if (!res.ok) {
        throw new Error('No se pudieron cargar los comentarios');
      }
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

  // Estados para Post-Mortem
  const [showPostMortem, setShowPostMortem] = useState(false);
  const [postMortemData, setPostMortemData] = useState<PostMortem | null>(null);
  const [isCreatingPostMortem, setIsCreatingPostMortem] = useState(false);
  const [postMortemError, setPostMortemError] = useState<string | null>(null);
  const [isLoadingPostMortem, setIsLoadingPostMortem] = useState(false);
  const [isPostMortemLoaded, setIsPostMortemLoaded] = useState(false);

  // Formulario de Post-Mortem
  const [postMortemForm, setPostMortemForm] = useState({
    titulo: '',
    causaRaiz: '',
    descripcion: '',
    duracionMinutos: 0,
    usuariosAfectados: 0,
    sistemasAfectados: [] as string[],
    aciertos: [] as string[],
    errores: [] as string[],
    lecciones: [] as string[],
  });

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

  
  useEffect(() => {
    // En lugar de setState, usamos una variable local para controlar si debemos recargar
    // El siguiente useEffect se encargará de cargar los datos
  }, [incident.id]);

  
  useEffect(() => {
    let isMounted = true;
    
    // Si no hay postMortemId o ya está cargado, salir
    if (!incident.postMortemId || isPostMortemLoaded) {
      return;
    }

    const loadData = async () => {
      if (!isMounted) return;
      
      setIsLoadingPostMortem(true);
      try {
        
        if (incident.postMortemId) {
          const data = await getPostMortem(incident.postMortemId);
          if (data && isMounted) {
            setPostMortemData(data);
            setIsPostMortemLoaded(true);
          }
        }
      } catch (error) {
        console.error('Error loading post-mortem:', error);
      } finally {
        if (isMounted) {
          setIsLoadingPostMortem(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [incident.postMortemId, isPostMortemLoaded, getPostMortem]);

  useEffect(() => {
    // Resetear estados cuando cambia el incidente
    setIsPostMortemLoaded(false);
    setPostMortemData(null);
  }, [incident.id]);

  const handleCreatePostMortem = async () => {
    setIsCreatingPostMortem(true);
    setPostMortemError(null);

    try {
      const data = await createPostMortem({
        incidentId: incident.id,
        ...postMortemForm,
      });
      
      setPostMortemData(data);
      setIsPostMortemLoaded(true);
      setShowPostMortem(false);
      
      if (onPostMortemCreated) {
        onPostMortemCreated(incident.id, data.id);
      }
      
      if (onIncidentUpdated) {
        onIncidentUpdated({
          ...incident,
          postMortemId: data.id,
          postMortem: data,
        });
      }
    } catch (err) {
      setPostMortemError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsCreatingPostMortem(false);
    }
  };

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

          {/* Descripción */}
          <div>
            <p className="text-sm font-semibold text-foreground/70">Descripción</p>
            <p className="mt-2 rounded-lg border border-border bg-secondary/10 p-4 text-sm leading-relaxed text-foreground">
              {cleanDesc}
            </p>
          </div>

          {/* ============================================ */}
          {/* SECCIÓN POST-MORTEM                          */}
          {/* ============================================ */}

          {isResolved && !incident.postMortemId && !showPostMortem && (
            <div className="mt-4 p-4 rounded-lg border border-purple-200 bg-purple-50">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-purple-900">📋 Post-Mortem</h4>
                  <p className="text-sm text-purple-700 mt-1">
                    Este incidente ya está resuelto. Crea un post-mortem para documentar lecciones aprendidas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPostMortem(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition flex-shrink-0"
                >
                  <Clipboard className="h-4 w-4" />
                  Crear Post-Mortem
                </button>
              </div>
            </div>
          )}

          {incident.postMortemId && postMortemData && (
            <div className="mt-4 p-4 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900">Post-Mortem</h4>
                  <p className="text-sm font-medium text-green-800 mt-1">
                    {postMortemData.titulo}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-green-700 flex-wrap">
                    <span>Estado: <strong>{postMortemData.estado}</strong></span>
                    <span>Duración: {postMortemData.duracionMinutos} min</span>
                    <span>Usuarios: {postMortemData.usuariosAfectados}</span>
                    <span>Acciones pendientes: {postMortemData.acciones.filter(a => a.estado === 'PENDIENTE').length}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Causa raíz: {postMortemData.causaRaiz}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPostMortem(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-300 bg-white text-sm font-medium text-green-700 hover:bg-green-100 transition flex-shrink-0"
                >
                  <Edit2 className="h-4 w-4" />
                  Ver / Editar
                </button>
              </div>
            </div>
          )}

          {incident.postMortemId && isLoadingPostMortem && (
            <div className="mt-4 p-4 rounded-lg border border-border bg-gray-50 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600 mr-2" />
              <span className="text-sm text-foreground/60">Cargando post-mortem...</span>
            </div>
          )}

          {isClosed && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Solución / cierre</p>
              <div className="mt-2 rounded-lg border border-border bg-green-50/70 p-4 text-sm leading-relaxed text-foreground">
                <p className="font-medium text-green-900">
                  {isResolved ? 'Caso resuelto y cerrado correctamente.' : 'Caso cerrado correctamente.'}
                </p>
                <p className="mt-2 text-green-900/80">
                  {incident.resolutionSummary || cleanDesc || 'No se registró una solución detallada en el incidente.'}
                </p>
              </div>
            </div>
          )}

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoBlock label="SLA minutos previstos" value={`${incident.slaTargetMinutes} min`} />
            </div>
          )}

          {/* Comentarios */}
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-foreground/60" />
              <p className="text-sm font-semibold text-foreground/70">
                Comentarios{comentarios.length > 0 ? ` (${comentarios.length})` : ''}
              </p>
            </div>

            {comentariosError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {comentariosError}
              </div>
            )}

            <div className="mt-2 space-y-2">
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

      {/* ============================================ */}
      {/* MODAL DE POST-MORTEM                         */}
      {/* ============================================ */}
      {showPostMortem && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowPostMortem(false)}
        >
          <div 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-foreground/50">
                    {postMortemData ? 'Editar Post-Mortem' : 'Nuevo Post-Mortem'}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-foreground">
                    {postMortemData ? postMortemData.titulo : 'Crear Post-Mortem'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPostMortem(false)}
                  className="rounded-md border border-border p-2 text-foreground/70 hover:bg-secondary/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="space-y-4 px-6 py-5">
              {postMortemError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {postMortemError}
                </div>
              )}

              {postMortemData ? (
                // Vista de detalle del Post-Mortem existente
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBlock label="Estado" value={postMortemData.estado} />
                    <InfoBlock label="Creado" value={new Date(postMortemData.creadoEn).toLocaleDateString()} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBlock label="Duración" value={`${postMortemData.duracionMinutos} min`} />
                    <InfoBlock label="Usuarios afectados" value={postMortemData.usuariosAfectados} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Causa Raíz</p>
                    <p className="mt-1 p-3 rounded-lg bg-secondary/10 text-sm">{postMortemData.causaRaiz}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Descripción</p>
                    <p className="mt-1 p-3 rounded-lg bg-secondary/10 text-sm">{postMortemData.descripcion || 'Sin descripción'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-green-700">Aciertos</p>
                      <ul className="mt-1 list-disc list-inside text-sm text-foreground/70">
                        {postMortemData.aciertos.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                        {postMortemData.aciertos.length === 0 && <li className="text-foreground/40">No registrados</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-700">Errores</p>
                      <ul className="mt-1 list-disc list-inside text-sm text-foreground/70">
                        {postMortemData.errores.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                        {postMortemData.errores.length === 0 && <li className="text-foreground/40">No registrados</li>}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Lecciones aprendidas</p>
                    <ul className="mt-1 list-disc list-inside text-sm text-foreground/70">
                      {postMortemData.lecciones.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                      {postMortemData.lecciones.length === 0 && <li className="text-foreground/40">No registradas</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/70">Acciones correctivas</p>
                    <div className="mt-1 space-y-2">
                      {postMortemData.acciones.map((action) => (
                        <div key={action.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-white">
                          <div>
                            <p className="text-sm font-medium">{action.descripcion}</p>
                            <p className="text-xs text-foreground/50">Responsable: {action.responsable}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              action.estado === 'COMPLETADO' ? 'bg-green-100 text-green-700' :
                              action.estado === 'EN_PROGRESO' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            )}>
                              {action.estado}
                            </span>
                            <span className="text-xs text-foreground/40">
                              {new Date(action.fechaLimite).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {postMortemData.acciones.length === 0 && (
                        <p className="text-sm text-foreground/40">No hay acciones registradas</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Formulario de creación
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1">Título *</label>
                    <input
                      type="text"
                      value={postMortemForm.titulo}
                      onChange={(e) => setPostMortemForm({ ...postMortemForm, titulo: e.target.value })}
                      placeholder="Ej: Análisis de caída de pasarela de pagos"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1">Causa Raíz *</label>
                    <input
                      type="text"
                      value={postMortemForm.causaRaiz}
                      onChange={(e) => setPostMortemForm({ ...postMortemForm, causaRaiz: e.target.value })}
                      placeholder="Ej: Timeout en base de datos por falta de índices"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1">Descripción</label>
                    <textarea
                      value={postMortemForm.descripcion}
                      onChange={(e) => setPostMortemForm({ ...postMortemForm, descripcion: e.target.value })}
                      placeholder="Describe qué pasó en detalle..."
                      rows={3}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Duración (minutos)</label>
                      <input
                        type="number"
                        value={postMortemForm.duracionMinutos}
                        onChange={(e) => setPostMortemForm({ ...postMortemForm, duracionMinutos: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground/70 mb-1">Usuarios afectados</label>
                      <input
                        type="number"
                        value={postMortemForm.usuariosAfectados}
                        onChange={(e) => setPostMortemForm({ ...postMortemForm, usuariosAfectados: Number(e.target.value) })}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-700 mb-1">Aciertos</label>
                      <textarea
                        value={postMortemForm.aciertos.join('\n')}
                        onChange={(e) => setPostMortemForm({ ...postMortemForm, aciertos: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="Uno por línea..."
                        rows={3}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-700 mb-1">Errores</label>
                      <textarea
                        value={postMortemForm.errores.join('\n')}
                        onChange={(e) => setPostMortemForm({ ...postMortemForm, errores: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="Uno por línea..."
                        rows={3}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40 resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground/70 mb-1">Lecciones aprendidas</label>
                    <textarea
                      value={postMortemForm.lecciones.join('\n')}
                      onChange={(e) => setPostMortemForm({ ...postMortemForm, lecciones: e.target.value.split('\n').filter(Boolean) })}
                      placeholder="Uno por línea..."
                      rows={3}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40 resize-none"
                    />
                  </div>

                  <div className="text-xs text-foreground/40">
                    * Campos obligatorios
                  </div>
                </>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setShowPostMortem(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary/20"
              >
                {postMortemData ? 'Cerrar' : 'Cancelar'}
              </button>
              {!postMortemData && (
                <button
                  type="button"
                  onClick={handleCreatePostMortem}
                  disabled={isCreatingPostMortem || !postMortemForm.titulo || !postMortemForm.causaRaiz}
                  className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreatingPostMortem ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-4 w-4" />
                      Crear Post-Mortem
                    </>
                  )}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
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