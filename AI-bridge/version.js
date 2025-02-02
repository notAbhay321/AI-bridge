// Single source of truth for the extension version
export const VERSION = '1.2.0.2';

// Helper function to get version with 'v' prefix
export const getVersionString = () => `v${VERSION}`;

// Export version components for semantic versioning
export const [MAJOR, MINOR, PATCH] = VERSION.split('.').map(Number); 