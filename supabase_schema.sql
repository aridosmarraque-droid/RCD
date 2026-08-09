-- ==============================================================================
-- SCHEMA SQL PARA SUPABASE - APLICACIÓN PLANTA RCD ECO-MARRAQUE
-- Todos los nombres de tablas y columnas comienzan con la convención rcd_ / RCD_
-- para evitar cualquier conflicto con las tablas existentes de mantenimiento.
-- ==============================================================================

-- 1. TABLA DE CLIENTES RCD
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

-- 2. TABLA DE ALBARANES RCD
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

-- 3. TABLA DE CERTIFICADOS RCD
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
    rcd_status TEXT DEFAULT 'Emitido',
    rcd_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POLÍTICAS DE ACCESO PÚBLICO / ANON PARA SUPABASE (RLS)
ALTER TABLE public.rcd_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcd_albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rcd_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total lectura/escritura rcd_clients" ON public.rcd_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total lectura/escritura rcd_albaranes" ON public.rcd_albaranes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total lectura/escritura rcd_certificates" ON public.rcd_certificates FOR ALL USING (true) WITH CHECK (true);
