import React, { useState, useEffect } from 'react';
import { X, Database, MessageSquare, Check, Copy, AlertTriangle, Save, Send, Sparkles, Server, Mail, RefreshCw } from 'lucide-react';
import { SupabaseService } from '../services/supabaseClient';
import { UltramsgService } from '../services/ultramsgService';
import { EmailService } from '../services/emailService';
import { RCDService } from '../services/rcdStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'supabase' | 'ultramsg' | 'email'>('supabase');

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseSaved, setSupabaseSaved] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [migrationCopied, setMigrationCopied] = useState(false);

  // Ultramsg state
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [ultramsgSaved, setUltramsgSaved] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; success?: boolean }>({ loading: false });

  // Email Service state
  const [emailWebhookUrl, setEmailWebhookUrl] = useState('');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [emailSignerAddress, setEmailSignerAddress] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<{ loading: boolean; message?: string; success?: boolean }>({ loading: false });

  useEffect(() => {
    if (isOpen) {
      const supCreds = SupabaseService.getCredentials();
      setSupabaseUrl(supCreds.url);
      setSupabaseAnonKey(supCreds.anonKey);

      const ultraConfig = UltramsgService.getConfig();
      setInstanceId(ultraConfig.instanceId);
      setToken(ultraConfig.token);

      const emailConfig = EmailService.getConfig();
      setEmailWebhookUrl(emailConfig.webhookUrl);
      setEmailApiKey(emailConfig.apiKey);
      setEmailFromAddress(emailConfig.fromAddress);
      setEmailSignerAddress(emailConfig.signerAddress);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    SupabaseService.saveCredentials(supabaseUrl, supabaseAnonKey);
    setSupabaseSaved(true);
    setTimeout(() => setSupabaseSaved(false), 3000);
    onDataChanged();
  };

  const handlePurgeAndResync = () => {
    RCDService.clearAllData();
    onDataChanged();
    setSupabaseSaved(true);
    setTimeout(() => setSupabaseSaved(false), 3000);
  };

  const handleSaveUltramsg = (e: React.FormEvent) => {
    e.preventDefault();
    UltramsgService.saveConfig(instanceId, token);
    setUltramsgSaved(true);
    setTimeout(() => setUltramsgSaved(false), 3000);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    EmailService.saveConfig(emailWebhookUrl, emailApiKey, emailFromAddress, emailSignerAddress);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 3000);
  };

  const handleSendTestWhatsApp = async () => {
    if (!testPhone) return;
    setTestStatus({ loading: true });
    const res = await UltramsgService.sendWhatsApp(
      testPhone,
      '🧪 *Planta de Residuos RCD*\n\nPrueba de integración con Ultramsg completada con éxito. ¡Los avisos de descarga RCD y certificados están listos!'
    );
    if (res.success) {
      setTestStatus({ loading: false, success: true, message: '¡WhatsApp de prueba enviado correctamente!' });
    } else {
      setTestStatus({ loading: false, success: false, message: `Error: ${res.error}` });
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    setTestEmailStatus({ loading: true, message: 'Enviando petición a través del servidor...' });
    const res = await EmailService.sendEmail({
      to: testEmailAddress,
      subject: '🧪 [Planta RCD] Prueba de Notificación por Correo Electrónico',
      textBody: 'Prueba de integración con el servicio de Correo Electrónico / Webhook RCD completada con éxito.',
      htmlBody: '<h3>🧪 Planta de Residuos RCD</h3><p>Prueba de integración con el servicio de Correo Electrónico / Webhook RCD completada con éxito. ¡Las notificaciones automáticas de albaranes y certificados están listas!</p>',
    });
    if (res.success) {
      setTestEmailStatus({ loading: false, success: true, message: res.message || `¡Notificación de correo enviada con éxito a ${testEmailAddress}!` });
    } else {
      setTestEmailStatus({ loading: false, success: false, message: `Error: ${res.error}` });
    }
  };

  const sqlMigrationCode = `-- ========================================================
-- SCRIPT DE ACTUALIZACIÓN / MIGRACIÓN RÁPIDA PARA SUPABASE
-- (Ejecute esto si ya tenía creadas las tablas anteriormente)
-- ========================================================
ALTER TABLE IF EXISTS public.rcd_certificates
    ADD COLUMN IF NOT EXISTS rcd_status TEXT DEFAULT 'Pendiente de Firma',
    ADD COLUMN IF NOT EXISTS rcd_signature_data TEXT,
    ADD COLUMN IF NOT EXISTS rcd_signed_at TEXT,
    ADD COLUMN IF NOT EXISTS rcd_signer_name TEXT,
    ADD COLUMN IF NOT EXISTS rcd_signer_nif TEXT,
    ADD COLUMN IF NOT EXISTS rcd_fnmt_cert_issuer TEXT,
    ADD COLUMN IF NOT EXISTS rcd_fnmt_cert_serial TEXT,
    ADD COLUMN IF NOT EXISTS rcd_fnmt_hash TEXT,
    ADD COLUMN IF NOT EXISTS rcd_signature_type TEXT;`;

  const sqlDDLCode = `-- ========================================================
-- SQL COMPLETO PARA CREAR LAS TABLAS RCD DESDE CERO
-- ========================================================
CREATE TABLE IF NOT EXISTS public.rcd_clients (
    rcd_id TEXT PRIMARY KEY,
    rcd_code TEXT NOT NULL UNIQUE,
    rcd_name TEXT NOT NULL,
    rcd_cif TEXT NOT NULL,
    rcd_email TEXT,
    rcd_mobile TEXT,
    rcd_notify_email BOOLEAN DEFAULT TRUE,
    rcd_notify_mobile BOOLEAN DEFAULT TRUE,
    rcd_address TEXT,
    rcd_contact_person TEXT,
    rcd_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rcd_albaranes (
    rcd_id TEXT PRIMARY KEY,
    rcd_num_albaran TEXT NOT NULL UNIQUE,
    rcd_client_id TEXT REFERENCES public.rcd_clients(rcd_id) ON DELETE SET NULL,
    rcd_client_name TEXT NOT NULL,
    rcd_client_code TEXT NOT NULL,
    rcd_date TEXT NOT NULL,
    rcd_time TEXT NOT NULL,
    rcd_waste_type_code TEXT NOT NULL,
    rcd_waste_type_name TEXT NOT NULL,
    rcd_quantity_tons NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    rcd_license_plate TEXT NOT NULL,
    rcd_driver_name TEXT,
    rcd_albaran_photo_url TEXT,
    rcd_truck_photo_url TEXT,
    rcd_unload_photo_url TEXT,
    rcd_plant_zone TEXT,
    rcd_gps_coords TEXT,
    rcd_certified BOOLEAN DEFAULT FALSE,
    rcd_certificate_id TEXT,
    rcd_certificate_number TEXT,
    rcd_notifications_sent JSONB DEFAULT '{"mobileSent": false, "emailSent": false}'::jsonb,
    rcd_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rcd_certificates (
    rcd_id TEXT PRIMARY KEY,
    rcd_certificate_number TEXT NOT NULL UNIQUE,
    rcd_issue_date TEXT NOT NULL,
    rcd_client_id TEXT REFERENCES public.rcd_clients(rcd_id) ON DELETE SET NULL,
    rcd_client_name TEXT NOT NULL,
    rcd_client_cif TEXT NOT NULL,
    rcd_third_party_name TEXT,
    rcd_third_party_cif TEXT,
    rcd_construction_site_name TEXT,
    rcd_construction_site_address TEXT,
    rcd_albaran_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    rcd_waste_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    rcd_total_tons NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    rcd_issuer_name TEXT,
    rcd_verification_code TEXT NOT NULL,
    rcd_status TEXT DEFAULT 'Pendiente de Firma',
    rcd_signature_data TEXT,
    rcd_signed_at TEXT,
    rcd_signer_name TEXT,
    rcd_signer_nif TEXT,
    rcd_fnmt_cert_issuer TEXT,
    rcd_fnmt_cert_serial TEXT,
    rcd_fnmt_hash TEXT,
    rcd_signature_type TEXT,
    rcd_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rcd_users (
    rcd_id TEXT PRIMARY KEY,
    rcd_name TEXT NOT NULL,
    rcd_username_nif_cif TEXT NOT NULL UNIQUE,
    rcd_code TEXT NOT NULL,
    rcd_user_type TEXT NOT NULL,
    rcd_client_code TEXT,
    rcd_created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rcd_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcd_albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcd_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcd_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso rcd_clients" ON public.rcd_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso rcd_albaranes" ON public.rcd_albaranes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso rcd_certificates" ON public.rcd_certificates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso rcd_users" ON public.rcd_users FOR ALL USING (true) WITH CHECK (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlDDLCode);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const copyMigrationToClipboard = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setMigrationCopied(true);
    setTimeout(() => setMigrationCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg border border-emerald-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Configuración de Base de Datos y WhatsApp</h2>
              <p className="text-xs text-slate-400">Conexión con Supabase y Ultramsg API</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'supabase'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>1. Supabase BBDD (Campos RCD_)</span>
          </button>

          <button
            onClick={() => setActiveTab('ultramsg')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'ultramsg'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>2. WhatsApp Ultramsg</span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeTab === 'email'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>3. Correo Electrónico</span>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">

          {/* TAB 1: SUPABASE */}
          {activeTab === 'supabase' && (
            <div className="space-y-6">
              
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Compatibilidad garantizada con su BBDD de Mantenimientos</span>
                </div>
                <p>
                  Todos los campos de la aplicación RCD están prefijados con <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">rcd_</code> y las tablas son <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">rcd_clients</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">rcd_albaranes</code> y <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">rcd_certificates</code> para evitar cualquier interferencia con las tablas existentes de mantenimientos.
                </p>
              </div>

              {/* Supabase Form */}
              <form onSubmit={handleSaveSupabase} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Credenciales de Supabase Project</span>
                  {SupabaseService.isConfigured() ? (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ● Conectado a Supabase
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      ⚠️ Sin Configurar
                    </span>
                  )}
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    URL del proyecto Supabase (Project URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clave pública / Anon Key (API Key)
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-emerald-500/20"
                    >
                      <Save className="w-4 h-4" />
                      <span>Guardar y Conectar Supabase</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePurgeAndResync}
                      title="Limpia la caché del navegador y recarga los datos directamente desde Supabase"
                      className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Limpiar Caché y Resincronizar</span>
                    </button>
                  </div>

                  {supabaseSaved && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>¡Sincronizado con Supabase!</span>
                    </span>
                  )}
                </div>
              </form>

              {/* SQL Migration Box */}
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Script de Actualización / Migración Rápida</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Ejecute este comando si ya tenía tablas creadas para añadir las nuevas columnas de <strong>Firma Digital FNMT</strong> sin perder datos.
                    </p>
                  </div>
                  <button
                    onClick={copyMigrationToClipboard}
                    className="flex items-center space-x-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg transition shrink-0"
                  >
                    {migrationCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{migrationCopied ? '¡Copiado!' : 'Copiar Migración'}</span>
                  </button>
                </div>

                <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-300 max-h-36 overflow-y-auto whitespace-pre-wrap select-all">
                  {sqlMigrationCode}
                </pre>
              </div>

              {/* SQL DDL Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Código SQL Completo (Creación desde cero)</h4>
                    <p className="text-[11px] text-slate-400">Copie este código y ejecútelo en el <strong>SQL Editor</strong> de Supabase si instala la BBDD por primera vez.</p>
                  </div>
                  <button
                    onClick={copySqlToClipboard}
                    className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition shrink-0"
                  >
                    {sqlCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{sqlCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>

                <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                  {sqlDDLCode}
                </pre>
              </div>

            </div>
          )}

          {/* TAB 2: ULTRAMSG */}
          {activeTab === 'ultramsg' && (
            <div className="space-y-6">

              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 text-xs text-sky-300 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm text-sky-400">
                  <MessageSquare className="w-4 h-4" />
                  <span>Notificaciones WhatsApp Automatizadas con Ultramsg</span>
                </div>
                <p>
                  Al registrar albaranes de entrada o emitir certificados, la aplicación enviará automáticamente los detalles del ticket o certificado al WhatsApp del cliente si la opción de móvil está activada.
                </p>
              </div>

              <form onSubmit={handleSaveUltramsg} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Configuración de la API Ultramsg</span>
                  {UltramsgService.isConfigured() ? (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ● Ultramsg Activo
                    </span>
                  ) : (
                    <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                      Sin Configurar
                    </span>
                  )}
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ultramsg Instance ID
                  </label>
                  <input
                    type="text"
                    placeholder="instance12345"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ultramsg Token
                  </label>
                  <input
                    type="password"
                    placeholder="abc123xyztoken"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Ultramsg</span>
                  </button>

                  {ultramsgSaved && (
                    <span className="text-xs text-sky-400 font-bold flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>¡Configuración de Ultramsg guardada!</span>
                    </span>
                  )}
                </div>
              </form>

              {/* Test Phone Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Probar Envío de WhatsApp</h4>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="+34600000000"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    disabled={testStatus.loading || !testPhone}
                    onClick={handleSendTestWhatsApp}
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold px-4 py-2 rounded-lg text-xs transition border border-slate-700 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testStatus.loading ? 'Enviando...' : 'Probar Envío'}</span>
                  </button>
                </div>

                {testStatus.message && (
                  <p className={`text-xs font-medium mt-1 ${testStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testStatus.message}
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: EMAIL */}
          {activeTab === 'email' && (
            <div className="space-y-6">

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm text-emerald-400">
                  <Mail className="w-4 h-4" />
                  <span>Notificaciones de Albarán por Correo Electrónico</span>
                </div>
                <p>
                  Cada vez que un operario registra una entrada de vehículo en planta, el sistema envía una notificación automática por correo electrónico al cliente (si la opción de Email está activada en su ficha de cliente y tiene registrado su correo).
                </p>
              </div>

              <form onSubmit={handleSaveEmail} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Configuración del Servicio de Correo</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    ● Servicio Activo
                  </span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Correo Emisor de la Planta (From)
                  </label>
                  <input
                    type="email"
                    placeholder="notificaciones@plantarcd.es"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Correo del Responsable de Firma de Certificados (Aviso de firma pendiente)
                  </label>
                  <input
                    type="email"
                    placeholder="direccion@plantarcd.es"
                    value={emailSignerAddress}
                    onChange={(e) => setEmailSignerAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-amber-400 mt-1">
                     Recibirá un correo automático cada vez que un cliente solicite un certificado desde el portal para proceder a su firma digital.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    URL Webhook / API Servidor Correo (Opcional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.resend.com/emails o webhook de la empresa"
                    value={emailWebhookUrl}
                    onChange={(e) => setEmailWebhookUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clave de API / Token de Autenticación (Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="re_123456789"
                    value={emailApiKey}
                    onChange={(e) => setEmailApiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Configuración de Correo</span>
                  </button>

                  {emailSaved && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>¡Configuración de correo guardada!</span>
                    </span>
                  )}
                </div>
              </form>

              {/* Test Email Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Probar Envío de Correo Electrónico</h4>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={testEmailStatus.loading || !testEmailAddress}
                    onClick={handleSendTestEmail}
                    className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-4 py-2 rounded-lg text-xs transition border border-slate-700 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testEmailStatus.loading ? 'Enviando...' : 'Probar Envío Email'}</span>
                  </button>
                </div>

                {testEmailStatus.message && (
                  <p className={`text-xs font-medium mt-1 ${testEmailStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testEmailStatus.message}
                  </p>
                )}
              </div>

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
