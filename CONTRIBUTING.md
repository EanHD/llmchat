# Contributing to LLM Chat

Thank you for your interest in contributing to LLM Chat! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd llmchat
   ```

2. **Install dependencies** (optional, for testing)
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   # OR
   python3 -m http.server 8000 --directory public
   # OR use VS Code Live Server
   ```

4. **Access the app**
   ```
   http://localhost:8000
   ```

## Project Structure

```
llmchat/
├── public/               # Static assets (served directly)
│   ├── index.html       # Main HTML file
│   ├── app.js           # Application entry point
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service Worker
│   └── assets/          # CSS, images, icons
├── src/                 # JavaScript modules
│   ├── core/            # Core infrastructure (storage, state, API)
│   ├── models/          # Data models
│   ├── ui/              # UI components
│   └── utils/           # Helper utilities
├── specs/               # Feature specifications
└── tests/               # Test files
```

## Tech Stack

- **Language**: Vanilla JavaScript ES2020+
- **Modules**: Native ES modules (no bundler)
- **Storage**: IndexedDB for data, LocalStorage for settings
- **CSS**: CSS variables, no preprocessor
- **Testing**: Jest (unit), Playwright (E2E)

## Coding Standards

### JavaScript

- Use ES2020+ features (modules, async/await, optional chaining)
- Follow airbnb style guide (2 spaces, semicolons, single quotes)
- Use descriptive variable names (no abbreviations)
- Add JSDoc comments for public functions
- Avoid global variables
- Use const/let (never var)

### CSS

- Use CSS variables for theming
- Follow BEM naming convention where applicable
- Mobile-first responsive design
- Support both light and dark modes

### File Organization

- One class/component per file
- Export as ES module
- Group related functionality
- Keep files under 500 lines

## Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code restructuring
test: add/update tests
chore: maintenance tasks
```

Examples:
```
feat: implement message regeneration
fix: resolve streaming interruption issue
docs: update API integration guide
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, tested code
   - Update documentation
   - Add tests if applicable

3. **Test your changes**
   ```bash
   npm test
   npm run test:e2e
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Describe what changed and why
   - Reference related issues
   - Ensure CI passes

## Testing

### Unit Tests
```bash
npm test
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### E2E Tests
```bash
npm run test:e2e
```

## Issue Reporting

When reporting bugs, please include:

- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Console errors

## Feature Requests

For feature requests:

- Describe the use case
- Explain why it's valuable
- Propose implementation approach
- Consider edge cases

## Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Works in Chrome, Firefox, Safari
- [ ] Mobile responsive
- [ ] Dark mode compatible
- [ ] Accessibility checked
- [ ] No performance regressions

## Questions?

Feel free to open an issue for questions or discussion!
