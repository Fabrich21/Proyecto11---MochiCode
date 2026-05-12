'use client';

import { AlertTriangle, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SystemStatus {
  name: string;
  status: 'operational' | 'degraded' | 'offline' | 'maintenance';
  uptime: number;
}

const systemStatuses: SystemStatus[] = [
  { name: 'API', status: 'operational', uptime: 99.98 },
  { name: 'Pagos', status: 'degraded', uptime: 99.45 },
  { name: 'Autenticación', status: 'operational', uptime: 100 },
  { name: 'Base de Datos', status: 'operational', uptime: 99.92 },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'operational':
      return 'bg-success/10 text-success border-success/30';
    case 'degraded':
      return 'bg-warning/10 text-warning border-warning/30';
    case 'offline':
      return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'maintenance':
      return 'bg-info/10 text-info border-info/30';
    default:
      return 'bg-secondary/10 text-foreground border-secondary/30';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'operational':
      return <CheckCircle className="h-4 w-4" />;
    case 'degraded':
      return <AlertCircle className="h-4 w-4" />;
    case 'offline':
      return <AlertTriangle className="h-4 w-4" />;
    case 'maintenance':
      return <Zap className="h-4 w-4" />;
    default:
      return null;
  }
}

export function SystemStatusBar() {
  return (
    <div className="flex items-center gap-3 overflow-x-auto py-2">
      {systemStatuses.map((system) => (
        <div
          key={system.name}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-all',
            getStatusColor(system.status)
          )}
        >
          {getStatusIcon(system.status)}
          <span className="font-medium">{system.name}</span>
          <span className="text-xs opacity-70">{system.uptime}%</span>
        </div>
      ))}
    </div>
  );
}
