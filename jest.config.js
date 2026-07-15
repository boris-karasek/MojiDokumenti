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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^react-native-quick-crypto$': '<rootDir>/__mocks__/quick-crypto.js',
    '^@craftzdog/react-native-buffer$': '<rootDir>/__mocks__/buffer.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
  },
};