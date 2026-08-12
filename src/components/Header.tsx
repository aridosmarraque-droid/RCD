import React from 'react';
import { Truck, ShieldCheck, Users, Smartphone, Factory, Settings, LogOut, UserCheck, HardHat, Building2, Lock } from 'lucide-react';
import { RCDUser } from '../types/rcd';

export type AppMode = 'operator' | 'client' | 'admin';

interface HeaderProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  clientsList: { id: string; name: string; code: string }[];
  onOpenSettings: () => void;
  isSupabaseConfigured: boolean;
  currentUser: RCDUser | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  selectedClientId,
  setSelectedClientId,
  clientsList,
  onOpenSettings,
  isSupabaseConfigured,
  currentUser,
  onLogout,
}) => {
  const isEmpresa = currentUser?.userType === 'empresa';
  const isAdmin = currentUser?.userType === 'admin';
  const isTrabajador = currentUser?.userType === 'trabajador';

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center py-3 gap-3">
          
          {/* Column 1: Logo & Plant Name (Left) */}
          <div className="flex items-center space-x-3 justify-center md:justify-start">
            <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950 font-bold flex items-center justify-center shrink-0">
              <Factory className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-white leading-tight">Planta RCD EcoMarraque</h1>
              <p className="text-xs text-slate-400">Gestión de Residuos de Construcción</p>
            </div>
          </div>

          {/* Column 2: Mode Switcher Buttons (Locked in Center) */}
          <div className="flex items-center justify-center">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 shadow-inner shrink-0">
              {(!isEmpresa || isAdmin) && (
                <button
                  onClick={() => setMode('operator')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    mode === 'operator'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Entrada Báscula</span>
                </button>
              )}

              {(isEmpresa || isAdmin) && (
                <button
                  onClick={() => setMode('client')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    mode === 'client'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Portal Clientes</span>
                </button>
              )}

              {(!isEmpresa || isAdmin) && (
                <button
                  onClick={() => setMode('admin')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    mode === 'admin'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Panel Administrador</span>
                </button>
              )}
            </div>
          </div>

          {/* Column 3: Controls & User Session Info (Right) */}
          <div className="flex items-center space-x-2 justify-center md:justify-end">
            
            {/* Client selector (only if admin in client mode) */}
            {mode === 'client' && isAdmin && (
              <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-semibold rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[130px] sm:max-w-[160px]"
                >
                  {clientsList.length > 0 ? (
                    clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Sin clientes</option>
                  )}
                </select>
              </div>
            )}

            {/* Config BBDD Modal Button */}
            {(isAdmin || !currentUser) && (
              <button
                onClick={onOpenSettings}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition relative shrink-0"
                title="Configuración de BBDD Supabase"
              >
                <Settings className="w-4 h-4" />
                {!isSupabaseConfigured && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                )}
              </button>
            )}

            {/* User Logged Info Badge & Logout */}
            {currentUser && (
              <div className="flex items-center space-x-2 bg-slate-950 p-1.5 pl-3 rounded-xl border border-slate-800 shrink-0">
                <div className="text-right text-xs">
                  <div className="font-bold text-white flex items-center space-x-1 justify-end">
                    {isEmpresa ? (
                      <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : isAdmin ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <HardHat className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[100px] sm:max-w-[140px]">{currentUser.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    NIF: <strong className="text-emerald-400">{currentUser.nifCif}</strong>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-500/20 transition shrink-0"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
