// Dynamic config (replaces the old static app.json) so a single codebase can
// produce two installable apps side by side: the real "Flix" (production,
// talks to the production Supabase/Firebase projects) and "Flix (Dev)" (its
// own applicationId/scheme/Firebase project, for testing without touching
// live data). Selected via APP_VARIANT — defaults to production so a bare
// `expo prebuild` never accidentally regenerates native config under the
// dev identity.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: IS_DEV ? 'Flix (Dev)' : 'Flix',
    slug: 'flix-app',
    version: '1.0.0',
    orientation: 'portrait',
    // Must differ per variant — flixfix://reset-password otherwise can't
    // tell the OS which of the two installed apps should catch the link.
    scheme: IS_DEV ? 'flixfixdev' : 'flixfix',
    icon: './assets/logo2.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/logo2.png',
      resizeMode: 'contain',
      backgroundColor: '#0D0D0F',
    },
    plugins: [
      'expo-dev-client',
      [
        'expo-notifications',
        {
          icon: './assets/logoFlix.jpg',
          color: '#3A9EFB',
          sounds: [],
        },
      ],
      'expo-web-browser',
      'expo-font',
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'com.flixfix.app.dev' : 'com.flixfix.app',
    },
    android: {
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? 'com.flixfix.app.dev' : 'com.flixfix.app',
      googleServicesFile: IS_DEV ? './google-services.dev.json' : './google-services.json',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: IS_DEV ? 'flixfixdev' : 'flixfix',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/logo2.png',
    },
    extra: {
      eas: {
        projectId: '94131cbe-948a-4357-97e3-519f40fba025',
      },
      supabaseUrl: IS_DEV ? process.env.DEV_SUPABASE_URL : process.env.PROD_SUPABASE_URL,
      supabaseAnonKey: IS_DEV ? process.env.DEV_SUPABASE_ANON_KEY : process.env.PROD_SUPABASE_ANON_KEY,
    },
    owner: 'mimisnak',
  },
};
