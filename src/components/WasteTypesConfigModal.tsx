import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Factory, Check, AlertCircle } from 'lucide-react';
import { WasteType } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface WasteTypesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const WasteTypesConfigModal: React.FC<WasteTypesConfigModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New Waste Type form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'Limpio' | 'Sucio' | 'Tierras' | 'Peligroso' | 'Valorizable'>('Limpio');
  const [newPrice, setNewPrice] = useState<number>(10);
  const [newCapacity, setNewCapacity] = useState<number>(5000);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setWasteTypes(RCDService.getWasteTypes());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateCapacityPriceAndName = (code: string, capacity: number, price: number, name: string) => {
    const updated = wasteTypes.map((wt) => {
      if (wt.code === code) {
        return { ...wt, maxCapacityTons: capacity, pricePerTon: price, name };
      }
      return wt;
    });
    setWasteTypes(updated);
    RCDService.saveWasteTypes(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    onDataChanged();
  };

  const handleCreateNewWasteType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) {
      alert('Por favor ingrese el Código LER y la Denominación.');
      return;
    }

    const created: WasteType = {
      code: newCode.trim(),
      name: newName.trim(),
      category: newCategory,
      pricePerTon: Number(newPrice) || 0,
      maxCapacityTons: Number(newCapacity) || 5000,
      description: newDescription.trim() || `Residuo LER ${newCode}`,
    };

    RCDService.addOrUpdateWasteType(created);
    setWasteTypes(RCDService.getWasteTypes());

    // Reset form
    setNewCode('');
    setNewName('');
    setNewDescription('');
    setShowAddForm(false);
    onDataChanged();
  };

  const handleDeleteWasteType = (code: string) => {
    if (confirm(`¿Eliminar el tipo de residuo LER ${code} del catálogo?`)) {
      RCDService.deleteWasteType(code);
      setWasteTypes(RCDService.getWasteTypes());
      onDataChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg border border-emerald-500/30">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Configuración de Residuos y Capacidades</h2>
              <p className="text-xs text-slate-400">
                Catálogo de Residuos RCD (Códigos LER) y Capacidad Máxima de la Planta (Toneladas)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Listado de Residuos Admitidos ({wasteTypes.length})</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Nuevo Tipo de Residuo</span>
            </button>
          </div>

          {/* New Waste Type Form */}
          {showAddForm && (
            <form onSubmit={handleCreateNewWasteType} className="bg-slate-950 p-4 border border-emerald-500/30 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Registrar Nuevo Tipo de Residuo LER
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Código LER *
                  </label>
                  <input
                    type="text"
                    placeholder="p.ej. 17 03 02"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Denominación del Residuo *
                  </label>
                  <input
                    type="text"
                    placeholder="p.ej. Mezclas Bituminosas / Asfalto"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Limpio">Limpio</option>
                    <option value="Sucio">Sucio / Mezcla</option>
                    <option value="Tierras">Tierras / Excavación</option>
                    <option value="Valorizable">Valorizable</option>
                    <option value="Peligroso">Peligroso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Precio por Tonelada (€/t)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Capacidad Máxima Planta (t)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseFloat(e.target.value) || 1000)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-lg flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Residuo</span>
                </button>
              </div>
            </form>
          )}

          {/* Waste Types Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Código LER</th>
                  <th className="py-2.5 px-3">Denominación del Residuo</th>
                  <th className="py-2.5 px-3">Precio (€/t)</th>
                  <th className="py-2.5 px-3">Capacidad Máxima Planta (t)</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {wasteTypes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      No hay tipos de residuo configurados en la base de datos (tabla <code className="text-slate-400 font-mono">rcd_waste_types</code>). Pulse en "Añadir Nuevo Tipo de Residuo" para dar de alta los residuos de su planta.
                    </td>
                  </tr>
                ) : (
                  wasteTypes.map((wt) => (
                    <tr key={wt.code} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">LER {wt.code}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={wt.name}
                          onChange={(e) =>
                            handleUpdateCapacityPriceAndName(wt.code, wt.maxCapacityTons || 5000, wt.pricePerTon, e.target.value)
                          }
                          placeholder="Nombre / Descripción del residuo"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-semibold focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.5"
                          value={wt.pricePerTon}
                          onChange={(e) =>
                            handleUpdateCapacityPriceAndName(wt.code, wt.maxCapacityTons || 5000, parseFloat(e.target.value) || 0, wt.name)
                          }
                          className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-emerald-400 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="100"
                            value={wt.maxCapacityTons || 5000}
                            onChange={(e) =>
                              handleUpdateCapacityPriceAndName(wt.code, parseFloat(e.target.value) || 1000, wt.pricePerTon, wt.name)
                            }
                            className="w-28 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400">t</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteWasteType(wt.code)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition"
                          title="Eliminar tipo de residuo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {savedSuccess && (
            <div className="text-xs text-emerald-400 font-bold flex items-center space-x-1 justify-end">
              <Check className="w-4 h-4" />
              <span>Capacidades de la planta actualizadas correctamente.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
