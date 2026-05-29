'use client';

import { AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Incident } from './incident-types';

export interface IncidentCardProps {
  incident: Incident;
  onClick?: () => void;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-[#E94B3C]/20 border-[#E94B3C] text-[#E94B3C]';
    case 'high':
      return 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]';
    case 'medium':
      return 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6]';
    default:
      return 'bg-[#D9D9D9]/20 border-[#D9D9D9] text-[#D9D9D9]';
  }
}

function getSeverityLabel(severity: string) {
  switch (severity) {
    case 'critical':
      return 'Crítico';
    case 'high':
      return 'Alto';
    case 'medium':
      return 'Medio';
    default:
      return 'Desconocido';
  }
}

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const [timeAgoText, setTimeAgoText] = useState<string>('');

  useEffect(() => {
    const timeAgo = Math.floor((Date.now() - new Date(incident.createdAt).getTime()) / 60000);
    const text = timeAgo < 60 ? `${timeAgo}m` : `${Math.floor(timeAgo / 60)}h`;
    setTimeAgoText(text);
  }, [incident.createdAt]);

  return (
    <div
      className={cn(
        'rounded-lg border border-[#D9D9D9] bg-white p-4 transition-colors hover:bg-[#F5F5F5] transform transition-transform duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-lg',
        'animate-fade-up',
        onClick ? 'cursor-pointer focus-within:ring-2 focus-within:ring-[#3C6E71]/40' : ''
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="mt-1">
          <AlertTriangle className={cn('h-5 w-5', getSeverityColor(incident.severity))} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onClick}
            className="w-full text-left"
            disabled={!onClick}
            aria-label={onClick ? `Ver detalle del incidente ${incident.id}` : undefined}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-[#353535]">{incident.id}</span>
              <span
                className={cn(
                  'px-2 py-1 rounded text-xs font-semibold border',
                  getSeverityColor(incident.severity)
                )}
              >
                {getSeverityLabel(incident.severity)}
              </span>
              <span className="text-xs text-[#353535]">{timeAgoText}</span>
            </div>

            <h3 className="font-semibold text-[#353535] mb-1">{incident.system}</h3>
            <p className="text-sm text-[#353535] line-clamp-2">{incident.description}</p>
          </button>

          {incident.affectedUsers !== undefined && incident.affectedUsers > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-[#353535]">
              <TrendingUp className="h-3 w-3" />
              {incident.affectedUsers.toLocaleString('es-ES')} usuarios afectados
            </div>
          )}
        </div>

        {/* SLA */}
        <div className="text-right">
          <div className="text-sm font-semibold text-[#353535]">{incident.slaRemaining}m</div>
          <div className="h-1 w-16 rounded-full bg-[#D9D9D9] mt-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-colors',
                incident.slaPercentage > 50
                  ? 'bg-[#3C6E71]'
                  : incident.slaPercentage > 25
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#E94B3C]'
              )}
              style={{ width: `${incident.slaPercentage}%` }}
            />
          </div>
          <div className="text-xs text-[#353535] mt-1">SLA {incident.slaPercentage}%</div>
        </div>
      </div>
    </div>
  );
}
