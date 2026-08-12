import React, { useState } from 'react';
import {
  Lock,
  User,
  Building2,
  HardHat,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { RCDUser } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface LoginViewProps {
  onLoginSuccess: (user: RCDUser) => void;
  usersList: RCDUser[];
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, usersList }) => {
  const [authType, setAuthType] = useState<'trabajador' | 'empresa'>('trabajador');
  const [nifCifInput, setNifCifInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDemoHelp, setShowDemoHelp] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanNif = nifCifInput.trim().toUpperCase();
    const cleanCode = codeInput.trim();

    if (!cleanNif || !cleanCode) {
      setErrorMessage('Por favor introduzca su Usuario (NIF/CIF) y Código de acceso.');
      return;
    }

    // Match against current users
    const userMatch = usersList.find(
      (u) =>
        u.nifCif.trim().toUpperCase() === cleanNif &&
        u.code.trim() === cleanCode
    );

    if (!userMatch) {
      setErrorMessage('Credenciales incorrectas. Verifique su NIF/CIF y su Código de acceso.');
      return;
    }

    // Check user type matching selected tab (allow admin on worker tab)
    if (authType === 'empresa' && userMatch.userType !== 'empresa') {
      setErrorMessage('Este usuario es de tipo trabajador. Seleccione la pestaña de Trabajadores.');
      return;
    }

    // Save active user session
    RCDService.setCurrentUser(userMatch);
    onLoginSuccess(userMatch);
  };

  const handleQuickDemoLogin = (user: RCDUser) => {
    setNifCifInput(user.nifCif);
    setCodeInput(user.code);
    if (user.userType === 'empresa') {
      setAuthType('empresa');
    } else {
      setAuthType('trabajador');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Identity */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-500/10 mb-2">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Acceso Seguro Planta RCD</h1>
          <p className="text-xs text-slate-400">
            EcoMarraque S.L. — Sistema de Identificación y Control de Accesos
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Top Decorative Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500" />

          {/* User Type Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthType('trabajador');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition ${
                authType === 'trabajador'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span>Trabajador / Báscula</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthType('empresa');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition ${
                authType === 'empresa'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Empresa / Cliente</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-start space-x-3 text-rose-300 text-xs">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>{authType === 'trabajador' ? 'Usuario / NIF-DNI' : 'Usuario / CIF Empresa'}</span>
                <span className="text-[10px] text-slate-500 font-normal">Identificador único</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder={authType === 'trabajador' ? 'Ej: 12345678A o ADMIN' : 'Ej: B98765432'}
                  value={nifCifInput}
                  onChange={(e) => setNifCifInput(e.target.value)}
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm pl-10 pr-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 transition uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Código de Acceso / Clave</span>
                <span className="text-[10px] text-slate-500 font-normal">PIN o Código de cliente</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="w-full bg-slate-950 text-white font-mono text-sm pl-10 pr-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full font-extrabold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 text-sm transition mt-2 ${
                authType === 'trabajador'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20'
              }`}
            >
              <span>Iniciar Sesión en Planta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Demo Users Quick Help Toggle */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowDemoHelp(!showDemoHelp)}
              className="w-full flex items-center justify-center space-x-1.5 text-xs text-slate-400 hover:text-white transition py-1"
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Usuarios de Demostración Registrados</span>
            </button>

            {showDemoHelp && (
              <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
                <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider block">
                  Cuentas de prueba en Supabase / Local:
                </span>
                <div className="space-y-1.5">
                  {usersList.map((usr) => (
                    <div
                      key={usr.id}
                      onClick={() => handleQuickDemoLogin(usr)}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 cursor-pointer transition text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-white block">{usr.name}</span>
                        <span className="text-slate-400 font-mono">
                          NIF/CIF: <strong className="text-emerald-400">{usr.nifCif}</strong> | Clave: <strong className="text-slate-300">{usr.code}</strong>
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        usr.userType === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : usr.userType === 'trabajador'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      }`}>
                        {usr.userType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
