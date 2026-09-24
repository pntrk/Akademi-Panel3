import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akademipanel.app',
  appName: 'Akademi Panel',
  webDir: 'dist',
  server: {
    url: 'https://ais-pre-x6nc6rklovbsqyrxdgu2cr-740887989336.europe-west2.run.app',
    cleartext: true
  }
};

export default config;
