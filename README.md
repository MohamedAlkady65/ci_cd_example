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
npm run lint           # ESLint, auto-fixes what it can
npm run lint:check     # ESLint, report only (used in CI)
npm run format         # Prettier, rewrite files
npm run format:check   # Prettier, fail if files are not formatted (used in CI)
npm test               # Jest unit tests (used in CI)
npm run test:coverage  # Jest with a coverage report in coverage/
npm run check          # lint:check + format:check + test, same checks as CI
```

Run `npm run check` before pushing: CI runs the same three checks (inside the `ci` Docker image) and fails on any of them.

| Tool     | Config             | Notes                                                                                                                                                                       |
| -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint   | `eslint.config.js` | `@eslint/js` recommended rules, Node globals (Jest globals in `tests/`), `eslint-config-prettier` so it never conflicts with Prettier; ignores `node_modules/`, `coverage/` |
| Prettier | `.prettierrc.json` | Single quotes, 100-character lines; ignores `node_modules/`, `coverage/`, `package-lock.json` (`.prettierignore`)                                                           |
| Jest     | `package.json`     | Node test environment; tests live in `tests/` (`app.test.js` uses Supertest against the Express app)                                                                        |

## Docker

```bash
docker build --target production -t ci-cd-example .
docker run --rm -p 3000:3000 ci-cd-example
```

Run the CI checks (lint, format, tests) in a container, the same way CI does:

```bash
docker build --target ci -t ci-cd-example:ci .
docker run --rm ci-cd-example:ci
```

## Docker Compose

`compose.yaml` needs `ENV`, `APP_NAME`, `APP_PORT` and `IMAGE_TAG`. Copy `.env.example` to `.env` and adjust, then:

```bash
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml logs -f
docker compose -f compose.yaml down
```

## CI/CD pipeline

All workflows live in `.github/workflows/` and run on **self-hosted Linux runners** with Docker installed.

### Design principle: minimal per-environment configuration

The pipeline is intentionally built so that config per environment differ as little as possible and centerlized in few places. Configuration lives in exactly three places:

| Where                              | What                                                                  | Changes                 |
| ---------------------------------- | --------------------------------------------------------------------- | ----------------------- |
| **Git (source code)**              | Application code, Dockerfile, `compose.yaml`, workflows               | With every commit       |
| **The `.env` file** on each server | Everything that makes one environment behave differently from another | Rarely, per environment |
| **GitHub repository settings**     | Environments, runners and repository variables                        | Once, when setting up   |

- **The `.env` file is the only difference between environments.** Development, staging and production run the same code, the same image build and the same deploy steps; the env file alone describes how the system behaves in each one.
- **Repository settings are fixed wiring, not behaviour.** They only say which runner deploys which environment and where its env file is; they don't change how the app works.
- **Everything else comes from Git.** Any other behaviour is defined in the source code, so it is versioned, reviewed and deployed like any other change, and a commit or tag fully describes what runs.
- **Servers stay simple.** A deploy machine needs only Docker, a registered runner and its env file; no hand-made setup to recreate or keep in sync.

When adding a setting, keep this split: if it differs between environments, put it in the env file (and `.env.example`); otherwise put it in the code.

```mermaid
flowchart LR
    PR[Push / PR to main or dev] --> CI[ci.yml<br/>lint, format, test, smoke test]
    DEV[Push to dev] --> DD[deploy-dev.yml]
    TAG[Push tag v*] --> RD[release-deploy.yml]
    MAN[Manual run] --> MD[manual-deploy.yml<br/>validate ref]
    DD --> R[_deploy.yml<br/>reusable deploy job]
    RD --> R
    MD --> R
    R --> E1[(development)]
    R --> E2[(staging)]
    R --> E3[(production)]
```

| Workflow             | Trigger                                   | What it does                                                                |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `ci.yml`             | Push or pull request to `main` / `dev`    | Lint, format check, tests, then builds and smoke tests the production image |
| `deploy-dev.yml`     | Push to `dev`                             | Deploys the pushed commit to **development**                                |
| `release-deploy.yml` | Push of a version tag                     | Deploys `vX.Y.Z-rc.N` to **staging**, `vX.Y.Z` to **production**            |
| `manual-deploy.yml`  | Manual (Actions → manual-deploy → Run)    | Deploys any branch, tag or commit to the environment you pick               |
| `_deploy.yml`        | Called by the three deploy workflows only | The shared deploy job                                                       |

### CI (`ci.yml`)

Runs on the runner labelled with the `CI_RUNNER` variable. A new push to the same ref cancels the previous run.

1. **checks**: builds the `ci` Docker target and runs `lint:check`, `format:check` and `test` inside it.
2. **build** (after checks pass): builds the `production` target, starts it on port 3000 and calls `POST /sum` with `{"a":2,"b":3}`, expecting `{"result":5}`. Logs are printed and the container is removed whatever the result.

Both jobs end with `docker image prune -a -f` (even on failure), which removes the images they built and any other unused image on the runner.

### Deploy job (`_deploy.yml`)

A [reusable workflow](https://docs.github.com/actions/using-workflows/reusing-workflows) that every deploy goes through. Inputs:

| Input         | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `environment` | `development`, `staging` or `production`           |
| `ref`         | Commit (or branch/tag) to check out                |
| `image_tag`   | Docker image tag, passed to compose as `IMAGE_TAG` |

Steps:

1. Picks the runner for the environment: `DEVELOPMENT_RUNNER`, `STAGING_RUNNER`, or `PRODUCTION_RUNNER` for anything else.
2. Runs inside the GitHub environment, so its protection rules (e.g. required reviewers) and variables apply.
3. Checks out `ref` and verifies the environment's `ENV_FILE` variable is set and the file exists on the runner.
4. `docker compose build`, then `docker compose up -d --no-build --wait` (waits until the container is running).
5. Always prints the container logs and prunes unused images.

Deploys to the same environment never overlap: they share the `deploy-<environment>` concurrency group and queue instead of cancelling each other, whichever workflow started them.

### Development (`deploy-dev.yml`)

Every push to `dev` deploys that commit to **development** with image tag `dev-<commit sha>`. It does not wait for CI.

### Releases (`release-deploy.yml`)

Pushing a version tag deploys it; the image tag is the git tag.

```bash
git tag v1.2.3-rc.1 && git push origin v1.2.3-rc.1   # -> staging
git tag v1.2.3 && git push origin v1.2.3             # -> production
```

Tags that don't match `vX.Y.Z` or `vX.Y.Z-rc.N` don't trigger a deploy.

### Manual deploy (`manual-deploy.yml`)

Actions → **manual-deploy** → **Run workflow**, then choose:

- **environment**: any environment configured in the repo
- **ref**: a tag, branch or commit SHA (e.g. `v1.2.3`, `main`, `a1b2c3d`)

A **validate** job runs first on the target environment's runner. It rejects refs with characters outside `A-Z a-z 0-9 . _ / -`, then asks the GitHub API to resolve the ref to a full commit SHA and fails if no branch, tag or commit matches. The deploy then checks out that exact SHA, so a push to the branch while the run is queued doesn't change what gets deployed. The image tag is the ref with any character Docker doesn't allow replaced by `-` (e.g. `feature/x` → `feature-x`).

### Setup

Everything the pipeline needs outside the code: runners, repository variables, environments and env files.

#### Overview

| Environment   | Deployed by                  | Runner variable      | Image tag           | Env file             |
| ------------- | ---------------------------- | -------------------- | ------------------- | -------------------- |
| `development` | push to `dev`, manual        | `DEVELOPMENT_RUNNER` | `dev-<sha>` or ref  | `ENV_FILE` (env var) |
| `staging`     | tag `vX.Y.Z-rc.N`, manual    | `STAGING_RUNNER`     | git tag or ref      | `ENV_FILE` (env var) |
| `production`  | tag `vX.Y.Z`, manual         | `PRODUCTION_RUNNER`  | git tag or ref      | `ENV_FILE` (env var) |
| _(none)_ CI   | push / PR to `main` or `dev` | `CI_RUNNER`          | `<sha>`, `ci-<sha>` | not used             |

#### Runners

Every job runs on a self-hosted runner and requires three labels: `self-hosted`, `linux`, and a custom label whose value is stored in a repository variable.

| Runner      | Label comes from     | Runs                                                         |
| ----------- | -------------------- | ------------------------------------------------------------ |
| CI          | `CI_RUNNER`          | `ci.yml` (checks and build jobs)                             |
| Development | `DEVELOPMENT_RUNNER` | deploys to development, and the manual `validate` job for it |
| Staging     | `STAGING_RUNNER`     | deploys to staging, and the manual `validate` job for it     |
| Production  | `PRODUCTION_RUNNER`  | deploys to production, and the manual `validate` job for it  |

The runner **is** the deploy target: the app is started with Docker Compose on the machine the runner lives on. One machine can host several runners/labels, but each environment then needs its own `APP_PORT` and `ENV`.

Register a runner: Settings → Actions → Runners → **New self-hosted runner**, follow the download steps, then configure it with its label and install it as a service:

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <token> --labels <label>
sudo ./svc.sh install && sudo ./svc.sh start
```

Each runner machine needs:

- Docker Engine with the Compose v2 plugin (`docker compose`, 2.1+ for `--wait`)
- The runner's user in the `docker` group
- `git` and `curl` (`curl` is used by the CI smoke test and by the manual `validate` job)
- Deploy runners: the env file at the path set in the environment's `ENV_FILE`, readable by the runner user
- CI runner: port `3000` free (the smoke test publishes it and names its container `app`)

Notes:

- Deploys run `docker image prune -a -f`, which removes **every** image on the machine not used by a container, not only this project's.

#### Repository variables

Settings → Secrets and variables → Actions → **Variables** tab → Repository variables.

| Variable             | Required by                               | Example             | Meaning                         |
| -------------------- | ----------------------------------------- | ------------------- | ------------------------------- |
| `CI_APP_NAME`        | `ci.yml`                                  | `ci-cd-example`     | Image name for CI builds        |
| `CI_RUNNER`          | `ci.yml`                                  | `ci-runner`         | Label of the CI runner          |
| `DEVELOPMENT_RUNNER` | `deploy-dev.yml`, `manual-deploy.yml`     | `dev-runner`        | Label of the development runner |
| `STAGING_RUNNER`     | `release-deploy.yml`, `manual-deploy.yml` | `staging-runner`    | Label of the staging runner     |
| `PRODUCTION_RUNNER`  | `release-deploy.yml`, `manual-deploy.yml` | `production-runner` | Label of the production runner  |

The runner variables must be **repository** variables, not environment variables: `runs-on` is resolved before the job enters its environment. An unset runner variable leaves the job waiting forever for a runner with an empty label.

No secrets are used. Workflows only need the built-in `GITHUB_TOKEN` with `contents: read` (set in each file); the manual `validate` job uses it to resolve the ref through the GitHub API.

#### Environments

Settings → Environments → **New environment**. Create exactly these names (the workflows and the runner mapping use them):

- `development`
- `staging`
- `production`

On **each** environment add an environment variable:

| Variable   | Example                   | Meaning                                                            |
| ---------- | ------------------------- | ------------------------------------------------------------------ |
| `ENV_FILE` | `/opt/ci-cd-example/.env` | Absolute path of the env file on that environment's runner machine |

If it is missing or the file doesn't exist, the deploy fails at **Check env file exists**.

Upcoming protection rules (per environment):

- **Required reviewers**: a deploy waits for approval before it starts. Recommended for `production`.
- **Wait timer**: delay before a deploy starts.
- **Deployment branches and tags**: limit which refs may deploy. Note that for `manual-deploy.yml` GitHub checks the branch the workflow was run from ("Use workflow from"), not the `ref` input.

Only environments that exist in the repo appear in the manual deploy dropdown. Any environment other than `development` and `staging` uses `PRODUCTION_RUNNER`, so adding a new one also means adding it to the runner mapping in `_deploy.yml` and `manual-deploy.yml`.

#### Env files

One file per environment, stored on its runner machine outside the repository (at the `ENV_FILE` path), following `.env.example`:

```bash
ENV=production          # compose project and container name become <APP_NAME>-<ENV>
APP_NAME=ci-cd-example  # also the image name: <APP_NAME>-<ENV>:<IMAGE_TAG>
APP_PORT=3000           # host port mapped to the container's 3000
```

| Key         | Required | Notes                                                                          |
| ----------- | -------- | ------------------------------------------------------------------------------ |
| `ENV`       | yes      | Use the environment name; must differ between environments on the same machine |
| `APP_NAME`  | yes      | Project name                                                                   |
| `APP_PORT`  | yes      | Must be unique per environment on the same machine                             |
| `IMAGE_TAG` | no       | Set by the workflow; overrides any value in the file                           |
