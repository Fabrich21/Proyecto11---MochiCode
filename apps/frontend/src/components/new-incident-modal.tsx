'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Incident } from './incident-types';
import keycloak from '@/lib/keycloak';

interface Props {
  onClose: () => void;
  onCreated: (incident: Incident) => void;
}

type SistemaOption = {
  id: string;
  nombre: string;
  descripcion?: string | null;
};

type ApiSystemOption = {
  id?: string;
  sistemaId?: string;
  sistema_id?: string;
  nombre?: string;
  name?: string;
  descripcion?: string | null;
};

const PRIORIDADES = [
  { id: 'CRITICA', label: 'Crítica' },
  { id: 'ALTA', label: 'Alta' },
  { id: 'MEDIA', label: 'Media' },
  { id: 'BAJA', label: 'Baja' },
];

export function NewIncidentModal({ onClose, onCreated }: Props) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [sistemaId, setSistemaId] = useState('');
  const [sistemas, setSistemas] = useState<SistemaOption[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState('');
  const [prioridad, setPrioridad] = useState('ALTA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedAt] = useState<string>(new Date().toISOString());


  useEffect(() => {
    let cancelled = false;

    async function loadSystems() {
      setSystemsLoading(true);
      setSystemsError('');

      try {
        const res = await fetch('/api/systems', { cache: 'no-store' });

        if (!res.ok) {
          throw new Error('No se pudieron cargar los sistemas');
        }

        const json: unknown = await res.json();
        const items = Array.isArray(json) ? json : ((json as { data?: ApiSystemOption[] }).data ?? []);
        const normalized: SistemaOption[] = items
          .map((item) => ({
            id: String(item.id ?? item.sistemaId ?? item.sistema_id ?? ''),
            nombre: String(item.nombre ?? item.name ?? item.id ?? 'Sin nombre'),
            descripcion: item.descripcion ?? null,
          }))
          .filter((item: SistemaOption) => Boolean(item.id));

        if (cancelled) {
          return;
        }

        setSistemas(normalized);
        setSistemaId((current) => current || normalized[0]?.id || '');
      } catch (fetchError) {
        if (!cancelled) {
          setSystemsError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar los sistemas');
        }
      } finally {
        if (!cancelled) {
          setSystemsLoading(false);
        }
      }
    }

    void loadSystems();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!titulo.trim()) { setError('El título es obligatorio'); return; }
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    if (!sistemaId.trim()) { setError('Debes seleccionar un sistema'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                'Authorization': `Bearer ${keycloak?.token || ''}` },
        body: JSON.stringify({ titulo, descripcion, sistemaId, prioridad, detectedAt }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear incidente');
      }

      const data = await res.json();
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <section
        className="w-full max-w-lg rounded-xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-foreground/50">Nuevo incidente</p>
            <h3 className="mt-1 text-lg font-bold text-foreground">Registrar incidente</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-2 text-foreground/70 hover:bg-secondary/20"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Retraso en entrega de kit clínico"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Descripción *</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el incidente en detalle..."
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1">Sistema afectado</label>
              <select
                value={sistemaId}
                onChange={(e) => setSistemaId(e.target.value)}
                disabled={systemsLoading || !sistemas.length}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
              >
                {systemsLoading && <option value="">Cargando sistemas...</option>}
                {!systemsLoading && systemsError && <option value="">{systemsError}</option>}
                {!systemsLoading && !systemsError && !sistemas.length && <option value="">No hay sistemas disponibles</option>}
                {!systemsLoading && !systemsError && sistemas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1">Prioridad</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3C6E71]/40"
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary/20"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-[#3C6E71] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d5558] disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar incidente'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default NewIncidentModal;