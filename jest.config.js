/**
 * jest.config.js — omogućava testiranje crypto logike NA LAPTOPU, bez uređaja.
 *
 * Trik: react-native-quick-crypto kopira API Node-ovog `crypto` modula,
 * pa ga u testovima mapiramo na pravi Node crypto. Time testiramo LOGIKU
 * (format šifrata, roundtrip, IV, tamper detekcija), dok CryptoTestScreen
 * na uređaju ostaje autoritativan test NATIVE implementacije.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^react-native-quick-crypto$': '<rootDir>/__mocks__/quick-crypto.js',
    '^@craftzdog/react-native-buffer$': '<rootDir>/__mocks__/buffer.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
  },
  // `mrz` je ESM-only paket bez CJS builda — Jest po default-u ne transformiše
  // node_modules, pa ga eksplicitno provlačimo kroz ts-jest (allowJs) da bi
  // se `export`/`import` sintaksa svela na CommonJS koji Jest runtime razume.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    'node_modules/mrz/.+\\.js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'commonjs', target: 'es2019' } }],
  },
  transformIgnorePatterns: ['node_modules/(?!mrz/)'],
};