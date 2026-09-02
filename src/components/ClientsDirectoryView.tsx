import React, { useState } from 'react';
import { Users, Mail, Phone, CheckSquare, Square, Save, CheckCircle2, ShieldCheck, Search, Building2 } from 'lucide-react';
import { Client } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface ClientsDirectoryViewProps {
  clients: Client[];
  onClientsUpdated: () => void;
}

export const ClientsDirectoryView: React.FC<ClientsDirectoryViewProps> = ({ clients, onClientsUpdated }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form edit states
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCif, setEditCif] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editNotifyEmail, setEditNotifyEmail] = useState(true);
  const [editNotifyMobile, setEditNotifyMobile] = useState(true);

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setEditName(client.name || '');
    setEditCode(client.code || '');
    setEditCif(client.cif || '');
    setEditEmail(client.email || '');
    setEditMobile(client.mobile || '');
    setEditNotifyEmail(client.notifyEmail);
    setEditNotifyMobile(client.notifyMobile);
    setErrorId(null);
  };

  const handleSave = async (client: Client) => {
    if (!editName.trim()) {
      setErrorId(client.id);
      setErrorMessage('El nombre / razón social del cliente no puede estar vacío.');
      return;
    }

    try {
      await RCDService.updateClientNotificationSettings(
        client.id,
        editNotifyEmail,
        editNotifyMobile,
        editEmail.trim(),
        editMobile.trim(),
        editName.trim(),
        editCode.trim(),
        editCif.trim()
      );
      setEditingId(null);
      setSavedSuccessId(client.id);
      setErrorId(null);
      onClientsUpdated();

      setTimeout(() => {
        setSavedSuccessId(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error saving client:', err);
      setErrorId(client.id);
      setErrorMessage(err.message || 'Error al guardar los datos del cliente.');
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Search and Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Fichas de Clientes & Configuración de Notificaciones</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configura el email, teléfono y los canales automáticos (Móvil / Email) para notificar cada descarga en planta.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente, código o CIF..."
            className="w-full bg-slate-950 text-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClients.map((client) => {
          const isEditing = editingId === client.id;
          const isSaved = savedSuccessId === client.id;

          return (
            <div
              key={client.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg transition-all ${
                isEditing ? 'border-emerald-500/80 bg-slate-900/90 ring-1 ring-emerald-500/30' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between mb-3 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-slate-800 text-emerald-400 p-2.5 rounded-xl font-mono font-bold text-xs border border-slate-700">
                    {client.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{client.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">CIF/NIF: {client.cif}</p>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => startEdit(client)}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    Editar Ficha
                  </button>
                )}
              </div>

              {/* Saved Toast Notification */}
              {isSaved && (
                <div className="mb-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Configuración de notificaciones guardada correctamente.</span>
                </div>
              )}

              {/* Card Body: Editing mode vs Viewing mode */}
              {isEditing ? (
                <div className="space-y-4 pt-1">
                  {errorId === client.id && (
                    <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-2.5 text-xs text-rose-200">
                      {errorMessage}
                    </div>
                  )}

                  {/* Client Name Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Razón Social / Nombre del Cliente *</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="ej. CONSTRUCCIONES MARRAQUE S.L."
                      className="w-full bg-slate-950 text-white font-bold text-xs sm:text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Code & CIF Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Código SAP (ej: C0096)
                      </label>
                      <input
                        type="text"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        placeholder="C0096"
                        className="w-full bg-slate-950 text-slate-200 font-mono text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        NIF / CIF
                      </label>
                      <input
                        type="text"
                        value={editCif}
                        onChange={(e) => setEditCif(e.target.value.toUpperCase())}
                        placeholder="B12345678"
                        className="w-full bg-slate-950 text-slate-200 font-mono text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                      <Mail className="w-3.5 h-3.5 text-sky-400" />
                      <span>Correo Electrónico (Email)</span>
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="ej. obras@empresa.com"
                      className="w-full bg-slate-950 text-white text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Teléfono Móvil (SMS / WhatsApp)</span>
                    </label>
                    <input
                      type="text"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      placeholder="ej. +34 612 345 678"
                      className="w-full bg-slate-950 text-white text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Ticks Configuration */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <span className="text-xs font-bold text-slate-300 block mb-1">
                      Canales de Envío Automático por Descarga:
                    </span>

                    {/* Tick 1: Mobile */}
                    <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={editNotifyMobile}
                        onChange={(e) => setEditNotifyMobile(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold">
                        Enviar cada descarga al <strong className="text-emerald-400">Móvil (SMS / WhatsApp)</strong>
                      </span>
                    </label>

                    {/* Tick 2: Email */}
                    <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={editNotifyEmail}
                        onChange={(e) => setEditNotifyEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="font-semibold">
                        Enviar cada descarga al <strong className="text-sky-400">Email</strong>
                      </span>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl text-xs transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSave(client)}
                      className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2 rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md shadow-emerald-500/20 transition"
                    >
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Email:</span>
                    <span className="font-semibold text-white">{client.email || 'No especificado'}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Móvil:</span>
                    <span className="font-mono font-semibold text-white">{client.mobile || 'No especificado'}</span>
                  </div>

                  {/* Active Channels Display */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Notificaciones automáticas:</span>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          client.notifyMobile
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        Móvil
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          client.notifyEmail
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        Email
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
