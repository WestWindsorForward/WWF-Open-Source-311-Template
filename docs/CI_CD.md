# CI/CD

## GitHub Actions
- Workflow in `.github/workflows/ci.yml` runs on push/PR:
  - Backend job installs dependencies and compiles the FastAPI app (drop in pytest/ruff later).
  - Frontend job runs `npm run build` to ensure Vite bundle health.
- Extend with Docker image builds, Trivy scans, and deployment steps as needed.

## Release Steps
1. Merge changes into `main` once CI passes.
2. Build & push images:
   ```bash
   docker build -t ghcr.io/<org>/township-backend:<tag> backend
   docker build -t ghcr.io/<org>/township-frontend:<tag> frontend
   docker push ghcr.io/<org>/township-backend:<tag>
   docker push ghcr.io/<org>/township-frontend:<tag>
   ```
3. Run migrations:
   ```bash
   ./scripts/run_migrations.sh
   ```
4. Redeploy (Docker Compose or Kubernetes) and monitor `/health` + `/metrics` + logs for regressions.

## Promotion & Rollback
- Use distinct env files / secrets per environment.
- For Kubernetes, leverage rolling updates or blue/green via multiple Deployments and switch the Service selector.
- To rollback, redeploy the previous image tag and re-run migrations if required (prefer reversible migrations).
