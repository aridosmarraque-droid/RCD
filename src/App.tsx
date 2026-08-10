import React, { useState, useEffect } from 'react';
import { Header, AppMode } from './components/Header.tsx';
import { OperatorMobileView } from './components/OperatorMobileView.tsx';
import { ClientPortalView } from './components/ClientPortalView.tsx';
import { AdminPlantView } from './components/AdminPlantView.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { RCDService } from './services/rcdStorage';
import { SupabaseService } from './services/supabaseClient';
import { Client, Albaran, Certificate } from './types/rcd';

export default function App() {
  const [mode, setMode] = useState<AppMode>('operator');
  const [clients, setClients] = useState<Client[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState<boolean>(false);

  const loadData = async () => {
    setIsSupabaseConfigured(SupabaseService.isConfigured());

    const loadedClients = await RCDService.loadClientsFromRemote();
    const loadedAlbaranes = await RCDService.loadAlbaranesFromRemote();
    const loadedCertificates = await RCDService.loadCertificatesFromRemote();

    setClients(loadedClients);
    setAlbaranes(loadedAlbaranes);
    setCertificates(loadedCertificates);

    if (loadedClients.length > 0 && (!selectedClientId || !loadedClients.find((c: Client) => c.id === selectedClientId))) {
      setSelectedClientId(loadedClients[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Navigation Header */}
      <Header
        mode={mode}
        setMode={setMode}
        selectedClientId={selectedClientId}
        setSelectedClientId={setSelectedClientId}
        clientsList={clients.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSupabaseConfigured={isSupabaseConfigured}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {mode === 'operator' && (
          <OperatorMobileView
            onAlbaranCreated={() => {
              loadData();
            }}
          />
        )}

        {mode === 'client' && (
          activeClient ? (
            <ClientPortalView
              client={activeClient}
              albaranes={albaranes}
              certificates={certificates}
              onRefreshData={loadData}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 space-y-4">
              <div className="text-4xl">🏗️</div>
              <h3 className="text-lg font-bold text-white">Sin Clientes Registrados</h3>
              <p className="text-xs text-slate-400">
                Aún no hay clientes en la base de datos de Supabase o local. Registre una entrada en la App de Operario o introduzca las credenciales de Supabase.
              </p>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition"
              >
                Configurar Supabase BBDD
              </button>
            </div>
          )
        )}

        {mode === 'admin' && (
          <AdminPlantView
            clients={clients}
            albaranes={albaranes}
            certificates={certificates}
            onRefreshData={loadData}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataChanged={loadData}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Planta de Residuos RCD EcoMarraque S.L.</strong> — Conexión BBDD Supabase & Ultramsg WhatsApp
          </div>
          <div className="text-[11px] text-slate-600">
            Conforme a Ley 7/2022 de Residuos y RD 105/2008 RCD
          </div>
        </div>
      </footer>

    </div>
  );
}
