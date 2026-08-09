/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ULTRAMSG_INSTANCE_ID?: string;
  readonly VITE_ULTRAMSG_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
