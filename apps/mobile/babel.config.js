module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its Babel plugin from react-native-worklets; it MUST be
    // listed last. (babel-preset-expo now wires up expo-router itself.)
    plugins: ['react-native-worklets/plugin'],
  };
};
