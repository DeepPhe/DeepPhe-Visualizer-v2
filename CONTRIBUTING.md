# Contributing to DeepPhe Visualizer v2

Thank you for considering contributing to DeepPhe Visualizer v2! This document outlines the process and guidelines for contributing.

## Code of Conduct

Be respectful, constructive, and professional in all interactions.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
- Check the issue tracker to avoid duplicates
- Use the latest version of DeepPhe Visualizer v2
- Collect relevant information (browser, Node version, error messages)

When submitting a bug report, include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and environment details

### Suggesting Features

Feature requests are welcome! Please:
- Search existing issues first
- Describe the feature and its use case
- Explain how it benefits users
- Consider implementation complexity

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Write or update tests
5. Run the test suite
   ```bash
   npm test
   npm run lint
   npm run lint:a11y
   ```
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/DeepPhe-Visualizer-v2.git
cd DeepPhe-Visualizer-v2

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start
```

## Code Standards

### JavaScript/React

- Use functional components with hooks
- Follow ESLint rules (run `npm run lint`)
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Keep components small and focused (under 300 lines)
- Extract reusable logic into custom hooks

### Accessibility

- All interactive elements must be keyboard accessible
- Images require descriptive alt text
- Form inputs must have labels
- Use semantic HTML elements
- Test with screen readers when possible
- Run `npm run lint:a11y` before committing

### Testing

- Write tests for new features
- Maintain or improve code coverage
- Use React Testing Library best practices
- Test user interactions, not implementation details
- Run `npm test -- --coverage` to check coverage

### File Organization

```
src/
├── components/      # Reusable UI components
├── views/          # Page-level components
├── hooks/          # Custom React hooks
├── utils/          # Pure utility functions
├── controllers/    # Business logic
├── clients/        # API clients
└── constants/      # Application constants
```

### Naming Conventions

- Components: PascalCase (e.g., `FilterableTable.jsx`)
- Hooks: camelCase with "use" prefix (e.g., `useDataLoader.js`)
- Utilities: camelCase (e.g., `dataProcessing.js`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_BAR_CHART_VALUES`)

## Commit Messages

Write clear, descriptive commit messages:

```
Add feature: Brief description

Longer explanation of what changed and why.

- Specific change 1
- Specific change 2
```

Good examples:
- `Add accessibility labels to data tables`
- `Fix filter reset bug in debug view`
- `Refactor useDataLoader hook for better error handling`

Avoid:
- `fix bug`
- `update stuff`
- `wip`

## Testing Guidelines

### Unit Tests

Place test files next to source files:
```
src/utils/
├── dataProcessing.js
└── __tests__/
    └── dataProcessing.test.js
```

### Test Structure

```javascript
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupInput();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Accessibility Testing

- Manual keyboard testing (Tab, Enter, Space, Arrow keys)
- Check axe-core warnings in browser console
- Test with screen reader if possible (VoiceOver, NVDA)
- Verify color contrast meets WCAG 2.1 AA (4.5:1)

## Documentation

Update documentation when:
- Adding new features
- Changing APIs or interfaces
- Modifying configuration
- Adding dependencies

Update these files as needed:
- README.md - User-facing documentation
- ACCESSIBILITY.md - Accessibility guidelines
- JSDoc comments - Function documentation
- Code comments - Complex logic explanation

## Review Process

Pull requests will be reviewed for:
- Code quality and style
- Test coverage
- Accessibility compliance
- Documentation updates
- Performance considerations
- Breaking changes

Reviewers may request changes. Please respond promptly and address feedback.

## Release Process

Maintainers handle releases. Contributors should:
- Target the `main` branch for features
- Update CHANGELOG.md for significant changes
- Note any breaking changes clearly

## Questions?

Open an issue with the "question" label or reach out to maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.


