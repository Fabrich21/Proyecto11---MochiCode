// import type { Config } from 'jest';
// Using any to bypass TS error temporarily
const config: any = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.(t|j)s', '!**/main.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Resuelve el alias "src/" que usa el controlador al importar el guard
    '^src/(.*)$': '<rootDir>/$1',
  },
};

export default config;
