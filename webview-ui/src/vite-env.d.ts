/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: {
    readonly [key: string]: string | boolean | undefined;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly VITE_APP_TITLE?: string;
    // Add any other custom env variables you're using
  };
}
