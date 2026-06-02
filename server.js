/**
 * DeepPhe Piper Files Server
 * Read-only HTTP endpoint for viewing .piper configuration files
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const config = require('./src/piper-server/config');

const app = express();

// Middleware
app.use(express.json());

// Security: Validate piper filename
function validatePiperFilename(name) {
  // Must match: /^[A-Za-z0-9._-]+\.piper$/
  // No slashes, no "..", no backslashes, no null bytes, no absolute paths
  const pattern = /^[A-Za-z0-9._-]+\.piper$/;
  return pattern.test(name);
}

// Parse load directives from piper file content
function parseLoadDirectives(content) {
  const loads = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }
    // Match "load <path>" directives
    const match = trimmed.match(/^load\s+(.+)$/);
    if (match) {
      loads.push(match[1].trim());
    }
  }
  
  return loads;
}

// Check if a loaded file exists on disk
async function checkLoadExists(loadPath) {
  try {
    // Convert load path to potential .piper file path
    // load pipeline/ZipPrefs -> pipeline/ZipPrefs.piper
    const piperPath = path.join(config.PIPER_FILES_DIR, loadPath + '.piper');
    
    // Security: prevent path traversal
    const normalized = path.normalize(piperPath);
    if (!normalized.startsWith(config.PIPER_FILES_DIR)) {
      return false;
    }
    
    await fs.access(normalized);
    return true;
  } catch {
    return false;
  }
}

// Get piper file metadata
async function getPiperMetadata(filePath) {
  const loads = [];
  const missingLoads = [];
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const loadDirectives = parseLoadDirectives(content);
    
    for (const loadPath of loadDirectives) {
      loads.push(loadPath);
      const exists = await checkLoadExists(loadPath);
      if (!exists) {
        missingLoads.push(loadPath);
      }
    }
  } catch (error) {
    // If we can't read the file for parsing, just return empty arrays
    // This shouldn't happen since we already read the file, but be defensive
  }
  
  return {
    loads,
    missingLoads,
  };
}

// Helper: Get full piper file path with validation
function getPiperFilePath(filename) {
  if (!validatePiperFilename(filename)) {
    return null;
  }
  
  const fullPath = path.join(config.PIPER_FILES_DIR, filename);
  const normalized = path.normalize(fullPath);
  
  // Security: prevent path traversal
  if (!normalized.startsWith(config.PIPER_FILES_DIR)) {
    return null;
  }
  
  return normalized;
}

// Helper: Read and validate piper file
async function readPiperFile(filePath) {
  const stats = await fs.stat(filePath);
  
  // Check size limit
  if (stats.size > config.PIPER_MAX_BYTES) {
    return { error: 'Piper file too large', statusCode: 413 };
  }
  
  // Check it's a regular file
  if (!stats.isFile()) {
    return { error: 'Not a regular file', statusCode: 400 };
  }
  
  const content = await fs.readFile(filePath, 'utf-8');
  
  return {
    stats,
    content,
  };
}

// GET {base}/piper - Get the current run's active piper file
app.get(`${config.PIPER_ROUTE_BASE}/piper`, async (req, res) => {
  try {
    // Resolve the active file
    const activeFile = await config.resolveActivePiperFile();
    
    if (!activeFile) {
      res.status(500).json({ error: 'Run piper file is not configured' });
      return;
    }
    
    const filename = path.basename(activeFile);
    const filePath = getPiperFilePath(filename);
    
    if (!filePath) {
      res.status(500).json({ error: 'Invalid active piper file configuration' });
      return;
    }
    
    const result = await readPiperFile(filePath);
    
    if (result.error) {
      res.status(result.statusCode).json({ error: result.error });
      return;
    }
    
    const metadata = await getPiperMetadata(filePath);
    const format = req.query.format || 'json';
    
    if (format === 'raw') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(result.content);
    } else {
      res.json({
        name: filename,
        size: result.stats.size,
        modified: result.stats.mtime.toISOString(),
        content: result.content,
        metadata,
      });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(500).json({ error: 'Failed to read piper file' });
    } else {
      res.status(500).json({ error: 'Failed to read piper file' });
    }
  }
});

// GET {base}/pipers - List all piper files and the active one
app.get(`${config.PIPER_ROUTE_BASE}/pipers`, async (req, res) => {
  try {
    const entries = await fs.readdir(config.PIPER_FILES_DIR, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.piper')) {
        const fullPath = path.join(config.PIPER_FILES_DIR, entry.name);
        const stats = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }
    
    // Sort by name ascending
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    // Get active file
    let active = null;
    try {
      const activePath = await config.resolveActivePiperFile();
      if (activePath) {
        active = path.basename(activePath);
      }
    } catch {
      // If we can't resolve the active file, set to null
      active = null;
    }
    
    res.json({
      directory: config.PIPER_FILES_DIR,
      active,
      files,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(500).json({ error: 'Piper files directory not found' });
    } else {
      res.status(500).json({ error: 'Failed to list piper files' });
    }
  }
});

// GET {base}/piper/:name - Get a specific piper file
app.get(`${config.PIPER_ROUTE_BASE}/piper/:name`, async (req, res) => {
  try {
    const filename = req.params.name;
    
    // Validate filename
    if (!validatePiperFilename(filename)) {
      res.status(400).json({ error: 'Invalid piper filename' });
      return;
    }
    
    const filePath = getPiperFilePath(filename);
    
    if (!filePath) {
      res.status(400).json({ error: 'Invalid piper filename' });
      return;
    }
    
    const result = await readPiperFile(filePath);
    
    if (result.error) {
      if (result.statusCode === 413) {
        res.status(413).json({ error: result.error });
      } else if (result.statusCode === 400) {
        res.status(400).json({ error: result.error });
      } else {
        res.status(400).json({ error: 'Not found' });
      }
      return;
    }
    
    const metadata = await getPiperMetadata(filePath);
    const format = req.query.format || 'json';
    
    if (format === 'raw') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(result.content);
    } else {
      res.json({
        name: filename,
        size: result.stats.size,
        modified: result.stats.mtime.toISOString(),
        content: result.content,
        metadata,
      });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(500).json({ error: 'Failed to read piper file' });
    }
  }
});

// Health check endpoint
app.get(`${config.PIPER_ROUTE_BASE}/health`, (req, res) => {
  res.json({ status: 'ok', piperFilesDir: config.PIPER_FILES_DIR });
});

// Start server
const PORT = process.env.PIPER_SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`DeepPhe Piper Server running on port ${PORT}`);
  console.log(`Piper files directory: ${config.PIPER_FILES_DIR}`);
  console.log(`Route base: ${config.PIPER_ROUTE_BASE}`);
});