/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_DATA_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
