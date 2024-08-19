/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    rootDir: './tests',
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.ts', '**/?(*.)+(spec|test).ts'],
    testTimeout: 9999999,
    verbose: true,
    silent: false,
};