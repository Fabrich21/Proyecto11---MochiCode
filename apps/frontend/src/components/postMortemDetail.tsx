'use client';

import React from 'react';
import { PostMortem } from './incident-types';
import { cn } from '@/lib/utils';
import { X, Check, Clock, Users, FileText, AlertTriangle, Clipboard } from 'lucide-react';

interface Props {
  postMortem: PostMortem;
  onClose: () => void;
}

export function PostMortemDetail({ postMortem, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-foreground/50">Post-Mortem</p>
              <h3 className="mt-1 text-xl font-bold text-foreground">{postMortem.titulo}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border p-2 text-foreground/70 hover:bg-secondary/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6 px-6 py-5">
          {/* Estado y metadata */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              postMortem.estado === 'APROBADO' ? 'text-green-700 border-green-300 bg-green-50' :
              postMortem.estado === 'PUBLICADO' ? 'text-blue-700 border-blue-300 bg-blue-50' :
              'text-yellow-700 border-yellow-300 bg-yellow-50'
            )}>
              Estado: {postMortem.estado}
            </span>
            <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
              {postMortem.duracionMinutos} min
            </span>
            <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
              {postMortem.usuariosAfectados} usuarios
            </span>
            <span className="rounded-full border border-border bg-secondary/20 px-3 py-1 text-xs font-medium text-foreground/80">
              {new Date(postMortem.creadoEn).toLocaleDateString()}
            </span>
          </div>

          {/* Causa Raíz */}
          <div>
            <p className="text-sm font-semibold text-foreground/70">Causa Raíz</p>
            <p className="mt-2 rounded-lg border border-border bg-secondary/10 p-4 text-sm leading-relaxed text-foreground">
              {postMortem.causaRaiz}
            </p>
          </div>

          {/* Descripción */}
          {postMortem.descripcion && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Descripción</p>
              <p className="mt-2 rounded-lg border border-border bg-secondary/10 p-4 text-sm leading-relaxed text-foreground">
                {postMortem.descripcion}
              </p>
            </div>
          )}

          {/* Sistemas afectados */}
          {postMortem.sistemasAfectados.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Sistemas afectados</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {postMortem.sistemasAfectados.map((sistema, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-secondary/10 px-3 py-1 text-xs font-medium text-foreground/70"
                  >
                    {sistema}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aciertos y Errores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-green-700">Aciertos</p>
              <ul className="mt-2 space-y-1">
                {postMortem.aciertos.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <span className="text-green-500">•</span>
                    {item}
                  </li>
                ))}
                {postMortem.aciertos.length === 0 && (
                  <li className="text-sm text-foreground/40">No registrados</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">Errores</p>
              <ul className="mt-2 space-y-1">
                {postMortem.errores.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <span className="text-red-500">•</span>
                    {item}
                  </li>
                ))}
                {postMortem.errores.length === 0 && (
                  <li className="text-sm text-foreground/40">No registrados</li>
                )}
              </ul>
            </div>
          </div>

          {/* Lecciones aprendidas */}
          {postMortem.lecciones.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Lecciones aprendidas</p>
              <ul className="mt-2 space-y-1">
                {postMortem.lecciones.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <span className="text-blue-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Acciones correctivas */}
          {postMortem.acciones.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground/70">Acciones correctivas</p>
              <div className="mt-2 space-y-2">
                {postMortem.acciones.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-white p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{action.descripcion}</p>
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
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <InfoBlock label="Creado por" value={postMortem.creadoPor} />
            <InfoBlock label="Creado en" value={new Date(postMortem.creadoEn).toLocaleString()} />
            {postMortem.aprobadoPor && (
              <InfoBlock label="Aprobado por" value={postMortem.aprobadoPor} />
            )}
            {postMortem.aprobadoEn && (
              <InfoBlock label="Aprobado en" value={new Date(postMortem.aprobadoEn).toLocaleString()} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/10 px-4 py-3">
      <p className="text-xs font-medium text-foreground/50">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}