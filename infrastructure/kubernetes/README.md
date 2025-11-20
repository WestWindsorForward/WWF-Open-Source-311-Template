# Kubernetes Deployment (Reference)

1. Build & push images:
   ```bash
   docker build -t ghcr.io/your-org/township-backend:latest ../../backend
   docker build -t ghcr.io/your-org/township-frontend:latest ../../frontend
   docker push ghcr.io/your-org/township-backend:latest
   docker push ghcr.io/your-org/township-frontend:latest
   ```
2. Create ConfigMap/Secret:
   ```bash
   kubectl apply -f configmap-example.yaml
   ```
3. Provision data stores:
   ```bash
   kubectl apply -f postgres-statefulset.yaml
   kubectl apply -f redis-deployment.yaml
   ```
4. Deploy app workloads:
   ```bash
   kubectl apply -f backend-deployment.yaml
   kubectl apply -f frontend-deployment.yaml
   kubectl apply -f celery-worker.yaml
   ```
5. Expose via ingress:
   ```bash
   kubectl apply -f ingress.yaml
   ```

Adjust hostnames, namespaces, replica counts, and resource requests for your cluster. For HA, scale backend/frontends to >=2 replicas and integrate cert-manager for TLS certificates. Schedule regular Postgres backups via `scripts/backup_postgres.sh` or storage snapshots.
