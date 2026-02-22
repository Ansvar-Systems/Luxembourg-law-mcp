# Contributing Guide

Thank you for your interest in contributing to Luxembourg Law MCP!

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/Luxembourg-law-mcp.git
   cd Luxembourg-law-mcp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Run tests**

   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Create a branch from `dev` for your changes:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run tests:
   ```bash
   npm test
   ```

4. Build to check for TypeScript errors:
   ```bash
   npm run build
   ```

5. Commit your changes:
   ```bash
   git commit -m "feat: description of changes"
   ```

6. Push and create a pull request **targeting `dev`** (not `main`)

### Testing with MCP Inspector

To test your changes interactively:

```bash
npx @anthropic/mcp-inspector node dist/index.js
```

This opens a web UI where you can call tools and see responses.

## Code Style

### TypeScript

- TypeScript ESM (`"type": "module"`)
- All imports use `.js` extension (TypeScript ESM convention)
- Use strict mode
- Define interfaces for all function inputs/outputs
- Use async/await for all database operations

### Naming

- Files: `kebab-case.ts`
- Interfaces: `PascalCase`
- Functions: `camelCase`
- MCP tools: `snake_case`
- Database tables/columns: `snake_case`

### Database

- All queries use prepared statements (parameterized) — never string interpolation
- FTS5 uses `MATCH` operator, never `LIKE`
- Journal mode must be `DELETE` (not WAL) for serverless compatibility

## Adding a New Tool

1. Create a new file in `src/tools/`:
   ```typescript
   // src/tools/my-tool.ts
   export interface MyToolInput { ... }
   export interface MyToolResult { ... }
   export async function myTool(db: Database, input: MyToolInput): Promise<MyToolResult> { ... }
   ```

2. Add tests in `tests/tools/my-tool.test.ts`

3. Register the tool in `src/tools/registry.ts`:
   - Add to `TOOLS` array with full description
   - Add case in `CallToolRequestSchema` handler switch

4. Update `README.md` with tool documentation

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] Contract tests pass (`npm run test:contract`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Documentation updated if needed

### PR Workflow

All PRs target `dev`, not `main`. The flow is:

```
feature-branch → PR to dev → verify on dev → PR to main → deploy
```

### Review Process

1. Automated checks must pass (CI, security scanning)
2. At least one maintainer review required
3. Address feedback promptly

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (Node version, OS)

### Data Errors

Use the "Data Error" issue template for incorrect, outdated, or missing legal data.

### Feature Requests

Include:
- Use case description
- Proposed solution (if any)
- Alternatives considered

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

## Questions?

Open a discussion on GitHub or contact hello@ansvar.ai.

---

Thank you for contributing!
