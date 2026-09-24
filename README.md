# ci-cd-example

Minimal Express API used as an example project for CI/CD setup.

## Usage

```bash
npm install
npm start          # listens on PORT (default 3000)
npm test           # run unit tests
npm run test:coverage
```

## API

`POST /sum` with JSON body `{ "a": 2, "b": 3 }` → `{ "result": 5 }`

Returns `400` if `a` or `b` is missing or not a finite number.

## Code quality

```bash
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier, rewrite files
npm run format:check   # Prettier, fail if files are not formatted
npm run check          # lint + format:check + test (use in CI)
```
