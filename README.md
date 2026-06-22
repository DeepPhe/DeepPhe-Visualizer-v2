# DeepPhe Visualizer v3

[![CI](https://github.com/DeepPhe/DeepPhe-viz-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/DeepPhe/DeepPhe-viz-v3/actions/workflows/ci.yml)
[![Accessibility](https://img.shields.io/badge/a11y-WCAG%202.1%20AA-green.svg)](https://www.w3.org/WAI/WCAG2AA-Conformance)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)
![Material-UI](https://img.shields.io/badge/Material--UI-5.16-007FFF?logo=mui&logoColor=white)
![Node](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/DeepPhe/DeepPhe-viz-v3/graphs/commit-activity)

A modern React application for medical data visualization and analysis, built with Material-UI and CRACO. DeepPhe Visualizer v3 is the next-generation visualization tool for cancer phenotype extraction and analysis.

## Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher

## Installation

```bash
# Clone the repository
git clone https://github.com/DeepPhe/DeepPhe-viz-v3.git
cd DeepPhe-viz-v3

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Development

```bash
npm start                # Start development server on port 3000
npm run dev              # Alias for npm start
```

### Testing

```bash
npm test                 # Run tests in watch mode
npm test -- --coverage   # Run tests with coverage report
npm run lint             # Run ESLint on source files
npm run lint:a11y        # Run accessibility-focused ESLint checks
```

### Production

```bash
npm run build            # Create production build
npm run eject            # Eject from react-scripts (one-way operation)
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d

# View logs
docker compose logs -f

# Stop the stack
docker compose down
```

Manual Docker commands:

```bash
# Build image
docker build -t deepphe-visualizer-v3 .

# Run container
docker run -d -p 3000:3000 --name deepphe-visualizer-v3 deepphe-visualizer-v3

# View logs
docker logs -f deepphe-visualizer-v3

# Stop and remove
docker stop deepphe-visualizer-v3 && docker rm deepphe-visualizer-v3
```

### Standalone Executable

The app can be packaged into a single self-contained executable (no Node.js
required on the target machine) with [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).
The binary serves the built SPA, mounts the read-only piper-files API, and
reverse-proxies the DeepPhe data API to a runtime-configurable upstream.

```bash
# Build the web bundle (same-origin API base) and package all targets
npm run package
```

Output binaries are written to `dist/` (one per platform):
`deepphe-visualizer-v3-macos-arm64`, `-macos-x64`, `-linux-x64`, `-win-x64.exe`.

**Build host requirements**

- Node.js **20+** (required by the pkg toolchain).
- A target is built natively or cross-built per platform. macOS **arm64** can
  only be built on an Apple Silicon host; macOS **x64**, Linux x64, and Windows
  x64 build on any x64 host. The packaging script skips (with a note) any target
  the current host can't fabricate.

**Running a binary**

```bash
# Piper files are read from ./data/piperfiles next to the executable
mkdir -p data/piperfiles   # then drop your .piper files in (or set PIPER_FILES_DIR)

PORT=3000 DEEPPHE_API_LOCATION=http://your-deepphe-host:3333 \
  ./deepphe-visualizer-v3-macos-x64
```

Then open [http://localhost:3000](http://localhost:3000). The DeepPhe backend is
resolved at runtime, so the same binary works against any backend with no CORS
configuration. See the runtime variables in
[Environment Variables](#environment-variables).

### Maintenance

```bash
npm run install:clean    # Clean install (removes node_modules and package-lock.json)
```

## API Configuration

The application connects to a DeepPhe Data API backend. Configure the API location in `src/config.js`:

```javascript
export const DEEPPHE_API_LOCATION = process.env.REACT_APP_DEEPPHE_API_LOCATION || "http://localhost:3333";
```

Or set the environment variable:

```bash
REACT_APP_DEEPPHE_API_LOCATION=http://localhost:3333 npm start
```

## Accessibility

This project is committed to WCAG 2.1 Level AA compliance. Key features:

- Runtime accessibility auditing with axe-core (development mode)
- ESLint rules for accessibility best practices
- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA attributes and semantic HTML

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for detailed guidelines and testing procedures.

## Code Quality

### ESLint Rules

The project enforces strict accessibility and code quality rules:

- All interactive elements must be keyboard accessible
- Images require alt text
- Form inputs must have labels
- Valid ARIA attributes
- Proper semantic HTML

### Testing

Unit tests use Jest and React Testing Library. Test files are co-located with source files:

Run tests with coverage:

```bash
npm test -- --coverage --watchAll=false
```

Run all tests once (non-watch):

```bash
npm test -- --watchAll=false --runInBand
```

## Browser Support

### Production

## Environment Variables

### Build / development

| Variable                         | Description               | Default                 |
|----------------------------------|---------------------------|-------------------------|
| `REACT_APP_DEEPPHE_API_LOCATION` | DeepPhe Data API base URL baked into the build | `http://localhost:3333` |
| `NODE_ENV`                       | Environment mode          | `development`           |
| `PORT`                           | Development server port   | `3000`                  |

> `npm run package:web` builds with `REACT_APP_DEEPPHE_API_LOCATION=/` so the
> packaged binary issues same-origin requests that flow through its reverse proxy.

### Standalone binary (runtime)

| Variable               | Description                                                   | Default                          |
|------------------------|--------------------------------------------------------------|----------------------------------|
| `PORT`                 | Port the unified server listens on                           | `3000`                           |
| `DEEPPHE_API_LOCATION` | Upstream DeepPhe data API origin the binary proxies to       | `http://localhost:3333`          |
| `PIPER_FILES_DIR`      | Directory of `.piper` files                                  | `data/piperfiles` next to binary |
| `PIPER_ACTIVE_FILE`    | Active piper filename within `PIPER_FILES_DIR` (optional)    | _unset_                          |

## Troubleshooting

### Port 3000 is already in use

```bash
# Find the process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or start on a different port
PORT=3001 npm start
```

### ESLint errors about react-app config

```bash
# Reinstall dependencies
npm install --legacy-peer-deps
```

### Build fails with peer dependency errors

```bash
# Clean install
npm run install:clean
```
