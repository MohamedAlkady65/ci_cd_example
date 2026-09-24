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

`GET /` → `{ "message": "Welcome to the ci-cd-example API!", "dateTime": "2026-09-24T12:00:00.000Z" }`

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

## Docker

```bash
docker build -t ci-cd-example .
docker run --rm -p 3000:3000 ci-cd-example
```

Run the CI checks (lint, format, tests) in a container, the same way CI does:

```bash
docker build --target ci -t ci-cd-example:ci .
docker run --rm ci-cd-example:ci
```

## Docker Compose

`compose.yaml` needs `APP_NAME`, `CONTAINER_NAME`, `APP_PORT` and `IMAGE_TAG`. Copy `.env.example` to `.env` and adjust, then:

```bash
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml logs -f
docker compose -f compose.yaml down
```
