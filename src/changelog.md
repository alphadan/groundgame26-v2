# Changelog
All notable changes to this project will be documented in this file.

## [0.1.0-alpha.1] - 2025-12-19
### Added
- **IndexedDB**: Implemented Dexie.js for local storage of constants.
- **Sync Engine**: Added version-check logic in `AuthContext` initialization.
- **Types**: Consolidated all interfaces into a single `src/types.ts` file.

### Fixed
- **App Check**: Resolved the 429 "Too Many Requests" error by using a static debug token.
- **Functions**: Fixed `ReferenceError: functions is not defined` in `index.js`.

### Security
- Added `SyncMetadata` checks to ensure users only download authorized data subsets.