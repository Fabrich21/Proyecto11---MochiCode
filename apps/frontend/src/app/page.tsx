'use client';

import { IncidentDashboard } from '@/components/incident-dashboard';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/context/useAuth';

export default function HomePage() {
  const keycloak = useAuth();
  const user = keycloak?.tokenParsed;
  const roles = user?.realm_access?.roles ?? [];
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
              
              {/* User Profile */}
              <div className="flex items-center gap-3 ml-4 border-l border-border pl-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user?.preferred_username || 'Usuario'}</p>
                  <p className="text-xs text-foreground/60">{roles.length > 0 ? roles.join(', ') : 'Operador'}</p>
                </div>
                <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-full shadow-md text-white font-bold">
                  {user?.preferred_username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button 
                  onClick={() => keycloak?.logout()}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition ml-2"
                  title="Cerrar sesión"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <IncidentDashboard />
      </main>
    </div>
  );
}
