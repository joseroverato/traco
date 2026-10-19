/// <reference types="vite/client" />
declare module '*?raw' { const s: string; export default s }
declare module '*?url' { const s: string; export default s }
interface ImportMetaEnv { readonly VITE_SINGLE?: string; readonly VITE_TARGET?: string }
declare const __APP_VERSION__: string
