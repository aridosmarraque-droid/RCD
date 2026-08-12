import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Building2,
  HardHat,
  ShieldCheck,
  Search,
  X,
  CheckCircle2,
  KeyRound,
  UserCheck
} from 'lucide-react';
import { RCDUser, Client } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface UsersManagementViewProps {
  users: RCDUser[];
  clients: Client[];
  onUsersChanged: () => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  users,
  clients,
  onUsersChanged,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<RCDUser | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNifCif, setFormNifCif] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formUserType, setFormUserType] = useState<'trabajador' | 'empresa' | 'admin'>('trabajador');
  const [formClientCode, setFormClientCode] = useState('');
  const [selectedClientIdInForm, setSelectedClientIdInForm] = useState('');
  const [formError, setFormError] = useState('');

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormNifCif('');
    setFormCode('');
    setFormUserType('trabajador');
    setFormClientCode('');
    setSelectedClientIdInForm('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: RCDUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormNifCif(user.nifCif);
    setFormCode(user.code);
    setFormUserType(user.userType);
    setFormClientCode(user.clientCode || '');
    
    // Match client ID if empresa
    const matchedClient = clients.find(
      (c) => (user.clientCode && c.code === user.clientCode) || c.cif === user.nifCif
    );
    setSelectedClientIdInForm(matchedClient ? matchedClient.id : '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleUserTypeChange = (type: 'trabajador' | 'empresa' | 'admin') => {
    setFormUserType(type);
    setFormError('');

    if (type === 'empresa' && clients.length > 0) {
      const firstClient = clients[0];
      setSelectedClientIdInForm(firstClient.id);
      setFormName(firstClient.name);
      setFormNifCif(firstClient.cif);
      setFormClientCode(firstClient.code);
      if (!formCode) setFormCode(firstClient.code);
    } else if (type !== 'empresa') {
      setSelectedClientIdInForm('');
      if (!editingUser) {
        setFormName('');
        setFormNifCif('');
        setFormClientCode('');
      }
    }
  };

  const handleSelectClientCompany = (clientId: string) => {
    setSelectedClientIdInForm(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setFormName(client.name);
      setFormNifCif(client.cif);
      setFormClientCode(client.code);
      setFormCode(client.code);
      setFormError('');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    const cleanNif = formNifCif.trim().toUpperCase();
    const cleanCode = formCode.trim();

    if (!cleanName || !cleanNif || !cleanCode) {
      setFormError('Por favor complete el Nombre, el NIF/CIF y el Código de acceso.');
      return;
    }

    // Check duplicate NIF/CIF if creating new
    if (!editingUser) {
      const exists = users.some((u) => u.nifCif.toUpperCase() === cleanNif);
      if (exists) {
        setFormError(`Ya existe un usuario con el NIF/CIF ${cleanNif}.`);
        return;
      }
    }

    const newUser: RCDUser = {
      id: editingUser ? editingUser.id : `user-${Date.now()}`,
      name: cleanName,
      nifCif: cleanNif,
      code: cleanCode,
      userType: formUserType,
      clientCode: formUserType === 'empresa' ? formClientCode : undefined,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
    };

    await RCDService.upsertUser(newUser);
    setIsModalOpen(false);
    onUsersChanged();
  };

  const handleDeleteUser = async (user: RCDUser) => {
    if (confirm(`¿Está seguro de eliminar el acceso de usuario para "${user.name}" (${user.nifCif})?`)) {
      await RCDService.deleteUser(user.id);
      onUsersChanged();
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.nifCif.toLowerCase().includes(term) ||
      u.code.toLowerCase().includes(term) ||
      (u.clientCode && u.clientCode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Gestión de Usuarios y Accesos Supabase</h2>
          </div>
          <p className="text-xs text-slate-400">
            Control de identidades para trabajadores de báscula y empresas de residuos
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Usuario</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por Nombre, NIF/CIF, Código o Razón Social..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 text-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium shrink-0 hidden sm:inline-block">
          Total: <strong className="text-white">{filteredUsers.length}</strong> usuarios
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Nombre / Empresa</th>
                <th className="py-3.5 px-4">Usuario (NIF / CIF)</th>
                <th className="py-3.5 px-4">Código / Clave</th>
                <th className="py-3.5 px-4 text-center">Tipo de Usuario</th>
                <th className="py-3.5 px-4 text-center">Cliente Vinculado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div className="flex items-center space-x-2">
                        {u.userType === 'empresa' ? (
                          <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : u.userType === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : (
                          <HardHat className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>{u.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {u.nifCif}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                        {u.code}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase ${
                        u.userType === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : u.userType === 'trabajador'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      }`}>
                        {u.userType === 'admin' ? 'Administración' : u.userType === 'trabajador' ? 'Trabajador Báscula' : 'Empresa Cliente'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-xs">
                      {u.clientCode ? (
                        <span className="text-sky-400 font-bold bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
                          {u.clientCode}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                          title="Editar usuario"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition border border-rose-500/20"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <span>{editingUser ? 'Editar Usuario de Acceso' : 'Registrar Nuevo Usuario'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tipo de Usuario:
                </label>
                <select
                  value={formUserType}
                  onChange={(e) => handleUserTypeChange(e.target.value as any)}
                  className="w-full bg-slate-950 text-white font-bold border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="trabajador">Trabajador / Operario de Báscula</option>
                  <option value="empresa">Empresa / Cliente RCD</option>
                  <option value="admin">Administrador de Dirección</option>
                </select>
              </div>

              {formUserType === 'empresa' ? (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Seleccionar Empresa Cliente de la BBDD:</span>
                      <span className="text-[10px] text-sky-400 font-normal">Clientes en BBDD ({clients.length})</span>
                    </label>
                    {clients.length === 0 ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2.5 rounded-xl text-[11px]">
                        ⚠️ No hay empresas en el Directorio de Clientes. Registre primero la empresa como cliente.
                      </div>
                    ) : (
                      <select
                        value={selectedClientIdInForm}
                        onChange={(e) => handleSelectClientCompany(e.target.value)}
                        className="w-full bg-slate-950 text-sky-400 font-bold border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
                        required
                      >
                        <option value="">-- Seleccione una Empresa Registrada --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            [{c.code}] {c.name} - CIF: {c.cif}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Nombre / Razón Social (BBDD Clientes):
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={formName}
                      placeholder="Seleccione empresa arriba"
                      className="w-full bg-slate-950/60 text-slate-300 font-bold border border-slate-800 rounded-xl px-3 py-2 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Usuario Login (CIF Fiscal de BBDD):
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={formNifCif}
                      placeholder="CIF automático"
                      className="w-full bg-slate-950/60 text-emerald-400 font-mono font-bold border border-slate-800 rounded-xl px-3 py-2 cursor-not-allowed uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Código de Cliente SAP Vinculado:
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={formClientCode}
                      placeholder="Código SAP automático"
                      className="w-full bg-slate-950/60 text-sky-400 font-mono font-bold border border-slate-800 rounded-xl px-3 py-2 cursor-not-allowed uppercase"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Nombre y Apellidos del Trabajador:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Pérez García"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-950 text-white font-bold border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Usuario de Login (NIF / DNI):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 12345678A"
                      value={formNifCif}
                      onChange={(e) => setFormNifCif(e.target.value)}
                      className="w-full bg-slate-950 text-white font-mono font-bold border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 uppercase"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Código de Acceso / Clave (PIN):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: OPER123 o C-00100"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full bg-slate-950 text-white font-mono text-sm font-bold border border-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Esta será la clave requerida para iniciar sesión con el NIF/CIF.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  Guardar Usuario
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
