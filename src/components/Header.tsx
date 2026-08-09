import React from 'react';
import { Truck, ShieldCheck, Users, Smartphone, Factory, RefreshCw } from 'lucide-react';

export type AppMode = 'operator' | 'client' | 'admin';

interface HeaderProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  clientsList: { id: string; name: string; code: string }[];
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  setMode,
  selectedClientId,
  setSelectedClientId,
  clientsList,
  onResetData,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 gap-3">
          
          {/* Logo & Plant Name */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950 font-bold flex items-center justify-center">
                <Factory className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-bold text-lg text-white leading-tight">Planta RCD EcoMarraque</h1>
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-medium border border-emerald-500/30 hidden md:inline-block">
                    SAP BO Sync
                  </span>
                </div>
                <p className="text-xs text-slate-400">Residuos de Construcción y Demolición</p>
              </div>
            </div>

            {/* Mobile Mode Badges */}
            <button
              onClick={onResetData}
              title="Restablecer datos de prueba"
              className="sm:hidden text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto justify-center">
            <button
              onClick={() => setMode('operator')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                mode === 'operator'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>App Operario Planta</span>
            </button>

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

            <button
              onClick={() => setMode('admin')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                mode === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administración</span>
            </button>
          </div>

          {/* Right Controls (Client Selector for Portal Mode & Reset Button) */}
          <div className="hidden lg:flex items-center space-x-3">
            {mode === 'client' && (
              <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <Users className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-slate-300 font-medium">Cliente Activo:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-semibold rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onResetData}
              title="Restablecer datos iniciales de demo"
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-emerald-400 bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Demo Reset</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
