/// <reference types="vite/client" />

declare module '@entrinsik/vite-plugin-informer' {
  import type { Plugin } from 'vite';
  export default function informer(options?: Record<string, unknown>): Plugin;
}
