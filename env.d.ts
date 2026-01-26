/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  // Add other VITE_ variables if you have them
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
