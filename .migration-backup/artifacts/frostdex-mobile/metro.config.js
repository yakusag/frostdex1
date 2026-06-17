const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block the massive temporary directories that viem, react-native, and other
// packages generate during pnpm install. These are not needed for bundling
// but eat up all available inotify file watchers in the Replit environment.
const blockList = [
  // pnpm temporary extraction directories (viem_tmp_*, react-native_tmp_*, etc.)
  /node_modules\/\.pnpm\/.*_tmp_\d+/,
  // Any other _tmp directories deep in pnpm
  /\.pnpm\/.*\/node_modules\/.*_tmp/,
];

config.resolver = {
  ...(config.resolver || {}),
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
      ? [config.resolver.blockList]
      : []),
    ...blockList,
  ],
};

module.exports = config;
