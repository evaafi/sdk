# EVAA SDK Development Guide

## Commands
- Build: `npm run build` or `yarn build`
- Test all: `npm test` or `yarn test`
- Test single file: `npx jest tests/filename_test.ts`
- Format code: `npx prettier --write src/**/*.ts`

## Code Style
- **Formatting**: 120 char line length, 4 spaces indentation, single quotes, trailing semicolons
- **Naming**: PascalCase for classes/interfaces/types, camelCase for variables/functions
- **Exports**: Group exports by functionality with comments separating sections
- **Types**: Use strict typing (TypeScript strict mode), explicit return types
- **Error Handling**: Use Try/Catch for async operations
- **Comments**: Add JSDoc for public APIs and complex functions
- **Imports**: Group imports by external packages first, then internal modules
- **Constants**: Use UPPER_SNAKE_CASE for constants

## Project Structure
- `src/`: Source code with subdirectories by functionality
- `tests/`: Jest tests matching `*_test.ts` pattern
- `dist/`: Compiled output (don't edit directly)