// Standard Expo Metro config. The mobile app is standalone (not an npm
// workspace), so it resolves everything from its own node_modules and needs
// no monorepo watchFolders / nodeModulesPaths overrides.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
