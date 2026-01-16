import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ryoxcarpentry.carptrack',
  appName: 'CarpTrack',
  webDir: 'out',
  server: {
    // Use the live server URL during development
    // Comment this out for production builds
    // url: 'http://localhost:3000',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'CarpTrack',
  },
  android: {
    backgroundColor: '#0a0a0a',
  },
};

export default config;
