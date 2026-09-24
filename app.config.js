// Each language build is compiled with its own base path (bridge spec §4.1),
// e.g. GAME_BASE_PATH=/games/shapes/he. Unset for local development.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.GAME_BASE_PATH ? { baseUrl: process.env.GAME_BASE_PATH } : {}),
  },
});
