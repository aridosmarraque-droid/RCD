import React, { useState, useEffect } from 'react';
import { Header, AppMode } from './components/Header';
import { OperatorMobileView } from './components/OperatorMobileView';
import { ClientPortalView } from './components/ClientPortalView';
import { AdminPlantView } from './components/AdminPlantView';
import { LoginView } from './components/LoginView';
import { SettingsModal } from './components/SettingsModal';
import { RCDService } from './services/rcdStorage';
import { SupabaseService } from './services/supabaseClient';
import { Client, Albaran, Certificate, RCDUser } from './types/rcd';

export default function App() {
  const [mode, setMode] = useState<AppMode>('operator');
  const [clients, setClients] = useState<Client[]>([]);
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [users, setUsers] = useState<RCDUser[]>([]);
  const [currentUser, setCurrentUser] = useState<RCDUser | null>(() => RCDService.getCurrentUser());
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState<boolean>(false);

  const loadData = async () => {
    setIsSupabaseConfigured(SupabaseService.isConfigured());

    const loadedClients = await RCDService.loadClientsFromRemote();
    const loadedAlbaranes = await RCDService.loadAlbaranesFromRemote();
    const loadedCertificates = await RCDService.loadCertificatesFromRemote();
    const loadedUsers = await RCDService.loadUsersFromRemote();

    setClients(loadedClients);
    setAlbaranes(loadedAlbaranes);
    setCertificates(loadedCertificates);
    setUsers(loadedUsers);

    // Sync current user state if saved
    const savedUser = RCDService.getCurrentUser();
    if (savedUser) {
      setCurrentUser(savedUser);
      applyUserSecurity(savedUser, loadedClients);
    }
  };

  const applyUserSecurity = (user: RCDUser, currentClientsList: Client[]) => {
    if (user.userType === 'empresa') {
      setMode('client');
      // Match client profile by clientCode or NIF/CIF
      const matchingClient = currentClientsList.find(
        (c) =>
          (user.clientCode && c.code.toLowerCase() === user.clientCode.toLowerCase()) ||
          (c.cif.toLowerCase() === user.nifCif.toLowerCase())
      );

      if (matchingClient) {
        setSelectedClientId(matchingClient.id);
      } else if (currentClientsList.length > 0) {
        setSelectedClientId(currentClientsList[0].id);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLoginSuccess = (user: RCDUser) => {
    setCurrentUser(user);
    applyUserSecurity(user, clients);
  };

  const handleLogout = () => {
    RCDService.logout();
    setCurrentUser(null);
    setMode('operator');
  };

  // Find active client for ClientPortalView
  let activeClient = clients.find((c) => c.id === selectedClientId);

  // If user is company and no matching client was found in DB, create virtual client profile
  if (!activeClient && currentUser?.userType === 'empresa') {
    activeClient = {
      id: `client-${currentUser.id}`,
      code: currentUser.clientCode || 'C-000',
      name: currentUser.name,
      cif: currentUser.nifCif,
      email: '',
      mobile: '',
      notifyEmail: true,
      notifyMobile: true,
      createdAt: currentUser.createdAt,
    };
  } else if (!activeClient && clients.length > 0) {
    activeClient = clients[0];
  }

  // Security Gate: If not logged in, render Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
        <Header
          mode={mode}
          setMode={setMode}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          clientsList={clients.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSupabaseConfigured={isSupabaseConfigured}
          currentUser={null}
          onLogout={handleLogout}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex items-center justify-center">
          <LoginView
            usersList={users}
            onLoginSuccess={handleLoginSuccess}
          />
        </main>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onDataChanged={loadData}
        />
      </div>
    );
  }

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
        currentUser={currentUser}
        onLogout={handleLogout}
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
            users={users}
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
