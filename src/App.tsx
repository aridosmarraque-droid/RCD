import React, { useState, useEffect } from 'react';
import { Header, AppMode } from '@/components/Header';
import { OperatorMobileView } from '@/components/OperatorMobileView';
import { ClientPortalView } from '@/components/ClientPortalView';
import { AdminPlantView } from '@/components/AdminPlantView';
import { RCDService } from '@/services/rcdStorage';
import { Client, Albaran, Certificate } from '@/types/rcd';

export default function App() {
  const [mode, setMode] = useState<AppMode>('operator');
  const [clients, setClients] = useState<Client[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const loadData = () => {
    const loadedClients = RCDService.getClients();
    const loadedAlbaranes = RCDService.getAlbaranes();
    const loadedCertificates = RCDService.getCertificates();

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

  const handleResetData = () => {
    if (confirm('¿Restablecer datos iniciales de demo de la Planta RCD?')) {
      RCDService.resetToDefaultData();
      loadData();
    }
  };

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
        onResetData={handleResetData}
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

        {mode === 'client' && activeClient && (
          <ClientPortalView
            client={activeClient}
            albaranes={albaranes}
            certificates={certificates}
            onRefreshData={loadData}
          />
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

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Planta de Residuos RCD EcoMarraque S.L.</strong> — Integrado con SAP Business One & Gemini AI Vision
          </div>
          <div className="text-[11px] text-slate-600">
            Conforme a Ley 7/2022 de Residuos y RD 105/2008 RCD
          </div>
        </div>
      </footer>

    </div>
  );
}
