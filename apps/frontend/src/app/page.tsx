'use client';

import { IncidentDashboard } from '@/components/incident-dashboard';
import { SystemStatusBar } from '@/components/system-status-bar';
import { Bell } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-foreground/60">Centro de Gestión de Incidentes</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-secondary/20 rounded-lg transition">
                <Bell size={20} className="text-accent" />
              </button>
              <div className="w-10 h-10 bg-primary rounded-full shadow-md"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <SystemStatusBar />
        </div>
      </div>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <IncidentDashboard />
      </main>
    </div>
  );
}
