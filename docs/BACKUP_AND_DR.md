# Backup & Disaster Recovery

## Database
- Use `scripts/backup_postgres.sh` with `DATABASE_URL` pointing to your Postgres instance.
  ```bash
  export DATABASE_URL=postgresql://postgres:pw@db:5432/township
  ./scripts/backup_postgres.sh /var/backups/township
  ```
- Restore via `scripts/restore_postgres.sh path/to/backup.sql`.
- Schedule backups via cron and ship artifacts offsite (object storage or HC3 replication).

## File Storage
- Branding assets, attachments, and generated PDFs live under `storage/`.
- Mount this path on persistent storage (PVC/HC3 volume) and snapshot alongside Postgres.

## Disaster Recovery Checklist
1. Restore Postgres from the latest dump/snapshot.
2. Rehydrate `storage/` from object storage or block volume snapshot.
3. Re-deploy backend/frontend images and run `scripts/run_migrations.sh` to ensure schema alignment.
4. Verify `/health`, `/metrics`, and perform a synthetic request submission before reopening to residents.

Define RPO/RTO targets per municipality and rehearse full restores in staging at least quarterly.
