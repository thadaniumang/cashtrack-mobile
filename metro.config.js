const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');


const projectRoot = __dirname;
// In the isolated mobile folder, `packages` is inside the project root
const localCashbackCorePath = path.resolve(projectRoot, 'packages', 'cashback-core');
let cashbackCoreSource = path.join(projectRoot, 'node_modules', '@cashtrack', 'cashback-core', 'src', 'index.ts');

const config = getDefaultConfig(projectRoot);

// Only add monorepo watchFolder when the packages folder exists on the build host.
if (require('fs').existsSync(localCashbackCorePath)) {
  config.watchFolders = [localCashbackCorePath];
  cashbackCoreSource = path.join(localCashbackCorePath, 'src', 'index.ts');
} else {
  // Ensure watchFolders is at least an empty array to avoid Metro issues
  config.watchFolders = config.watchFolders || [];
}

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@cashtrack/cashback-core': cashbackCoreSource,
};

module.exports = config;