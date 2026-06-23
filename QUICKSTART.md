# Quick Start Guide

Get DeepPhe Visualizer v2 running on your machine in under 5 minutes.

## Prerequisites

Check you have the required tools:

```bash
node --version   # Should be 18.x or higher
npm --version    # Should be 8.x or higher
```

If not installed, download from [nodejs.org](https://nodejs.org/)

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/DeepPhe/DeepPhe-Visualizer-v2.git
cd DeepPhe-Visualizer-v2

# 2. Install dependencies (use --legacy-peer-deps for compatibility)
npm install --legacy-peer-deps

# 3. Start the development server
npm start
```

The app opens automatically at [http://localhost:3000](http://localhost:3000)

## Backend API Setup

DeepPhe Visualizer v2 requires the DeepPhe Data API backend running on port 3333.

### Start the backend:

```bash
# In a separate terminal
cd /path/to/dphe-data-api
PORT=3333 npm start
```

### Configure API location (optional):

Create `.env.local` in DeepPhe-Visualizer-v2 root:

```env
REACT_APP_DEEPPHE_API_LOCATION=http://localhost:3333
```

## Verify Everything Works

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Open Debug View"
3. Expand any section (OMOP, Attributes, Concepts, Cancers)
4. You should see data loading and charts appearing

## Common Commands

```bash
npm start              # Start dev server
npm test               # Run tests
npm run lint           # Check code quality
npm run lint:a11y      # Check accessibility
npm run build          # Build for production
npm run package        # Build standalone executables -> dist/ (see README)
```

> `npm run package` produces self-contained binaries (no Node.js needed to run
> them) that serve the SPA and reverse-proxy the DeepPhe API. Requires Node 20+
> to build. See the [Standalone Executable](README.md#standalone-executable)
> section for details.

## Troubleshooting

### Port 3000 already in use

```bash
# Find and kill the process
lsof -i :3000
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

### API connection errors

- Check dphe-data-api is running on port 3333
- Verify `REACT_APP_DEEPPHE_API_LOCATION` in console output
- Check browser console for CORS errors

### npm install fails

```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps

# Or clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### ESLint errors about react-app

```bash
npm install eslint-config-react-app --legacy-peer-deps
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Review [ACCESSIBILITY.md](ACCESSIBILITY.md) for WCAG guidelines
- Check [CONTRIBUTING.md](CONTRIBUTING.md) to contribute
- Explore the codebase in `src/`

## Project Structure Overview

```
DeepPhe-Visualizer-v2/
├── src/
│   ├── components/     # Reusable UI components
│   ├── views/         # Page components (debug.js)
│   ├── controllers/   # API business logic
│   ├── hooks/         # Custom React hooks
│   └── utils/         # Helper functions
├── public/            # Static assets
└── build/             # Production build (after npm run build)
```

## Development Workflow

1. Create a feature branch
2. Make changes in `src/`
3. Test with `npm test`
4. Check linting with `npm run lint`
5. Verify accessibility with `npm run lint:a11y`
6. Build to verify no errors: `npm run build`
7. Commit and push

## Getting Help

- Check existing [GitHub Issues](https://github.com/DeepPhe/DeepPhe-Visualizer-v2/issues)
- Read the [FAQ](#) (coming soon)
- Open a new issue with the "question" label

Happy coding!

