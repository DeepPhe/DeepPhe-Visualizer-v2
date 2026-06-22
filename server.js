/**
 * DeepPhe Piper Files Server
 * Read-only HTTP endpoint for viewing .piper configuration files.
 *
 * Standalone entry point. The route handlers live in src/piper-server/router.js
 * so they can also be mounted by the unified production server (serve.js).
 */

const express = require("express");
const config = require("./src/piper-server/config");
const { createPiperRouter } = require("./src/piper-server/router");

const app = express();

app.use(createPiperRouter());

// Start server
const PORT = process.env.PIPER_SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`DeepPhe Piper Server running on port ${PORT}`);
  console.log(`Piper files directory: ${config.PIPER_FILES_DIR}`);
  console.log(`Route base: ${config.PIPER_ROUTE_BASE}`);
});
