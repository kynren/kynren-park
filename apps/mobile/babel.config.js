module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // In this npm-workspaces monorepo, expo-router is nested under
    // apps/mobile/node_modules, so babel-preset-expo (hoisted to the root) can't
    // resolve it via require.resolve and silently skips its expo-router
    // transform — which is what inlines EXPO_ROUTER_APP_ROOT for require.context.
    // Add that transform back explicitly so the router entry bundles.
    plugins: [require('babel-preset-expo/build/expo-router-plugin').expoRouterBabelPlugin],
  };
};
