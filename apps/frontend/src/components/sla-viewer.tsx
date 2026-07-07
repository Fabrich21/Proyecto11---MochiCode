'use client';

import React, { useEffect, useState } from 'react';
import { Incident } from './incident-types';
import { formatNumberES } from '@/lib/format';

interface SistemaOption {
  id: string;
  nombre: string;
}

export default function SlaViewer({ incidents }: { incidents: Incident[] }) {
  const [sistemasMap, setSistemasMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSystems() {
      try {
        const res = await fetch('/api/systems');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.data ?? []);
          const map: Record<string, string> = {};
          items.forEach((s: any) => {
            const id = s.id ?? s.sistemaId ?? s.sistema_id;
            const nombre = s.nombre ?? s.name ?? id;
            if (id) map[id] = nombre;
          });
          setSistemasMap(map);
        }
      } catch (error) {
        console.error('Error loading systems:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSystems();
  }, []);

  const total = incidents.length;
  const inSla = incidents.filter((i) => (i.slaRemaining ?? 0) > 0).length;
  const compliance = total === 0 ? 100 : Math.round((inSla / total) * 100);

  const topAtRisk = [...incidents]
    .sort((a, b) => (b.slaPercentage ?? 0) - (a.slaPercentage ?? 0))
    .slice(0, 4);

  // Función para obtener el nombre del sistema
  const getSystemDisplay = (incident: Incident) => {
    if (loading) return 'Cargando...';
    
    // Si tenemos el nombre del sistema en el mapa, usarlo
    const systemName = sistemasMap[incident.system];
    if (systemName) {
      // Extraer solo el código (ej: "PO7" de "PO7 - Sensor IoT")
      const codeMatch = systemName.match(/^([A-Z0-9]+)/);
      if (codeMatch) {
        return codeMatch[1]; // Retorna solo el código
      }
      return systemName;
    }
    
    // Si no está en el mapa, mostrar el ID truncado
    return incident.system.slice(0, 8);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Columna de cumplimiento SLA */}
      <div className="col-span-1 rounded-lg border border-border bg-white p-3 shadow-sm">
        <p className="text-xs font-medium text-foreground/60">Cumplimiento SLA</p>
        <p className="text-2xl font-bold text-accent mt-1">{compliance}%</p>
        <p className="text-xs text-foreground/70 mt-1">{inSla}/{total} dentro de SLA</p>
        <div className="w-full h-2 bg-secondary/10 rounded-full mt-3">
          <div className="h-2 rounded-full bg-success" style={{ width: `${compliance}%` }} />
        </div>
      </div>

      {/* Columna de mayor consumo SLA */}
      <div className="col-span-1 rounded-lg border border-border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground/60">Mayor consumo SLA</p>
          <p className="text-xs text-foreground/50">Top {topAtRisk.length}</p>
        </div>

        <div className="mt-3 space-y-2">
          {topAtRisk.length === 0 ? (
            <div className="text-foreground/60 text-xs">No hay incidentes</div>
          ) : (
            topAtRisk.map((inc) => {
              const systemDisplay = getSystemDisplay(inc);
              // Si el incidente tiene título, extraer la parte descriptiva
              const titleDisplay = inc.title 
                ? inc.title.replace(/^[^-]+-\s*/, '') // Remover el código del sistema si está en el título
                : '';
              
              return (
                <div key={inc.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground truncate">
                      <span className="font-bold">{systemDisplay}</span>
                      {titleDisplay && (
                        <span className="text-xs text-foreground/60 ml-1">
                          - {titleDisplay.length > 25 ? titleDisplay.slice(0, 25) + '...' : titleDisplay}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/70 ml-2 whitespace-nowrap">
                      {inc.slaPercentage ?? 0}%
                    </div>
                  </div>
                  <div className="w-full h-2 bg-secondary/10 rounded-full">
                    <div
                      className={`h-2 rounded-full ${
                        inc.slaPercentage && inc.slaPercentage > 80 
                          ? 'bg-destructive' 
                          : inc.slaPercentage && inc.slaPercentage > 50 
                            ? 'bg-warning' 
                            : 'bg-success'
                      }`}
                      style={{ width: `${inc.slaPercentage ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}