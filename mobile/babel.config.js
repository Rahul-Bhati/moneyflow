module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // SDK 54+: reanimated's plugin is replaced by `react-native-worklets/plugin`.
    // Must remain the LAST plugin in the list.
    plugins: ["react-native-worklets/plugin"],
  };
};
