
module.exports = ({ config }) => {
  const environment =
    process.env.EXPO_PUBLIC_APP_ENV || 'development';

  if (
    !['mock', 'development', 'staging', 'production'].includes(
      environment
    )
  ) {
    throw new Error('Unknown APP_ENV');
  }

  const secure = ['staging', 'production'].includes(environment);

  const url =
    (
      environment === 'production'
        ? process.env.EXPO_PUBLIC_API_BASE_URL_PROD
        : environment === 'staging'
          ? process.env.EXPO_PUBLIC_API_BASE_URL_STAGING
          : environment === 'mock'
            ? process.env.EXPO_PUBLIC_API_BASE_URL_MOCK
            : process.env.EXPO_PUBLIC_API_BASE_URL_DEV
    ) || process.env.EXPO_PUBLIC_API_BASE_URL;

  if (secure) {
    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error(
        'Set a real HTTPS API for staging/production.'
      );
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      /(^|\.)(localhost|example\.(com|org|test))$/i.test(
        parsed.hostname
      ) ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        parsed.hostname
      ) ||
      parsed.hostname === '[::1]'
    ) {
      throw new Error(
        'Set a real HTTPS API for staging/production.'
      );
    }
  }

  return {
    ...config,

    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: !secure,
          NSAllowsLocalNetworking: !secure,
        },
      },
    },

    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
      'expo-font',
      'expo-sqlite',
      './plugins/withDevelopmentNetwork',
      './plugins/withThemedSplashLogo',
    ],
  };
};
