'use client';

import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportIncidentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: IncidentFormData) => void;
}

export interface IncidentFormData {
  title: string;
  severity: 'critical' | 'high' | 'medium';
  system: string;
  description: string;
  affectedServices: string[];
  metadata: Record<string, string>;
  attachments: File[];
}

const severityOptions = [
  { value: 'critical', label: 'Crítico', color: 'bg-[#E94B3C]' },
  { value: 'high', label: 'Alto', color: 'bg-[#F59E0B]' },
  { value: 'medium', label: 'Medio', color: 'bg-[#3B82F6]' },
] as const;

const systemOptions = [
  'Pagos',
  'Logística',
  'API',
  'Autenticación',
  'Base de Datos',
  'CDN',
  'Cache',
  'Mensajería',
];

const serviceOptions = [
  'Transacciones',
  'Rastreo',
  'Consultas',
  'Sesiones',
  'Almacenamiento',
  'Distribución',
  'Redis',
  'Cola de Mensajes',
];

export function ReportIncidentDialog({
  isOpen,
  onClose,
  onSubmit,
}: ReportIncidentDialogProps) {
  const [formData, setFormData] = useState<Partial<IncidentFormData>>({
    severity: 'high',
    affectedServices: [],
    metadata: {},
    attachments: [],
  });
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && formData.title && formData.system && formData.description) {
      onSubmit({
        title: formData.title || '',
        severity: formData.severity as 'critical' | 'high' | 'medium',
        system: formData.system || '',
        description: formData.description || '',
        affectedServices: formData.affectedServices || [],
        metadata: formData.metadata || {},
        attachments: formData.attachments || [],
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-[#353535] border border-[#D9D9D9]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D9D9D9] px-6 py-4 sticky top-0 bg-[#353535]">
          <h2 className="text-xl font-bold text-[#FFFFFF]">Reportar Incidente</h2>
          <button
            onClick={onClose}
            className="text-[#D9D9D9] hover:text-[#FFFFFF] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#FFFFFF] mb-2">
              Título del Incidente *
            </label>
            <input
              type="text"
              required
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border border-[#D9D9D9] bg-[#353535] px-4 py-2 text-[#FFFFFF] placeholder-[#D9D9D9] focus:outline-none focus:border-[#3C6E71] focus:ring-2 focus:ring-[#3C6E71]/50"
              placeholder="Ej: Caída del servicio de pagos"
            />
          </div>

          {/* Severity and System */}
          <div className="grid grid-cols-2 gap-4">
            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-[#FFFFFF] mb-2">
                Severidad *
              </label>
              <select
                required
                value={formData.severity || 'high'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    severity: e.target.value as 'critical' | 'high' | 'medium',
                  })
                }
                className="w-full rounded-lg border border-[#D9D9D9] bg-[#353535] px-4 py-2 text-[#FFFFFF] focus:outline-none focus:border-[#3C6E71] focus:ring-2 focus:ring-[#3C6E71]/50"
              >
                {severityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* System */}
            <div>
              <label className="block text-sm font-medium text-[#FFFFFF] mb-2">
                Sistema Afectado *
              </label>
              <select
                required
                value={formData.system || ''}
                onChange={(e) => setFormData({ ...formData, system: e.target.value })}
                className="w-full rounded-lg border border-[#D9D9D9] bg-[#353535] px-4 py-2 text-[#FFFFFF] focus:outline-none focus:border-[#3C6E71] focus:ring-2 focus:ring-[#3C6E71]/50"
              >
                <option value="">Selecciona un sistema</option>
                {systemOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#FFFFFF] mb-2">
              Descripción del Incidente *
            </label>
            <textarea
              required
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-[#D9D9D9] bg-[#353535] px-4 py-2 text-[#FFFFFF] placeholder-[#D9D9D9] focus:outline-none focus:border-[#3C6E71] focus:ring-2 focus:ring-[#3C6E71]/50 min-h-24 resize-none"
              placeholder="Describe el incidente en detalle..."
            />
          </div>

          {/* Affected Services */}
          <div>
            <label className="block text-sm font-medium text-[#FFFFFF] mb-2">
              Servicios Afectados
            </label>
            <div className="grid grid-cols-2 gap-2">
              {serviceOptions.map((service) => (
                <label key={service} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.affectedServices || []).includes(service)}
                    onChange={(e) => {
                      const services = formData.affectedServices || [];
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          affectedServices: [...services, service],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          affectedServices: services.filter((s) => s !== service),
                        });
                      }
                    }}
                    className="rounded border-[#D9D9D9] accent-[#3C6E71]"
                  />
                  <span className="text-sm text-[#FFFFFF]">{service}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-[#D9D9D9]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#D9D9D9] px-4 py-2 font-medium text-[#FFFFFF] transition-colors hover:bg-[#D9D9D9]/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#3C6E71] px-4 py-2 font-medium text-[#FFFFFF] transition-colors hover:bg-[#3C6E71]/80"
            >
              Reportar Incidente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
