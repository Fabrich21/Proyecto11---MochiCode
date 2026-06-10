'use client';

import React from 'react';
import { Incident } from './incident-types';
import { formatNumberES } from '@/lib/format';

export default function SlaViewer({ incidents }: { incidents: Incident[] }) {
  const total = incidents.length;
  const inSla = incidents.filter((i) => (i.slaRemaining ?? 0) > 0).length;
  const compliance = total === 0 ? 100 : Math.round((inSla / total) * 100);

  const topAtRisk = [...incidents]
    .sort((a, b) => (b.slaPercentage ?? 0) - (a.slaPercentage ?? 0))
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="col-span-1 rounded-lg border border-border bg-white p-3 shadow-sm">
        <p className="text-xs font-medium text-foreground/60">Cumplimiento SLA</p>
        <p className="text-2xl font-bold text-accent mt-1">{compliance}%</p>
        <p className="text-xs text-foreground/70 mt-1">{inSla}/{total} dentro de SLA</p>
        <div className="w-full h-2 bg-secondary/10 rounded-full mt-3">
          <div className="h-2 rounded-full bg-success" style={{ width: `${compliance}%` }} />
        </div>
      </div>

      <div className="col-span-1 rounded-lg border border-border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground/60">Mayor consumo SLA</p>
          <p className="text-xs text-foreground/50">Top {topAtRisk.length}</p>
        </div>

        <div className="mt-3 space-y-2">
          {topAtRisk.length === 0 ? (
            <div className="text-foreground/60 text-xs">No hay incidentes</div>
          ) : (
            topAtRisk.map((inc) => (
              <div key={inc.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm">{inc.id}</div>
                  <div className="text-xs text-foreground/70">{inc.slaPercentage ?? 0}%</div>
                </div>
                <div className="w-full h-2 bg-secondary/10 rounded-full">
                  <div
                    className={`h-2 rounded-full ${inc.slaPercentage && inc.slaPercentage > 80 ? 'bg-destructive' : inc.slaPercentage && inc.slaPercentage > 50 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${inc.slaPercentage ?? 0}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
