const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports support
config.resolver.unstable_enablePackageExports = true;

// Add mjs to sourceExtensions
config.resolver.sourceExts.unshift('mjs');

module.exports = config;