# Township Plug-and-Play Appliance

This directory contains tooling that turns the Township stack into a pre-configured “appliance” image that towns can import into their own virtualisation platforms. Everything remains open source and self-hosted—the appliance simply removes the manual install steps.

## Components

- `first_boot.py` – console wizard that runs on first boot to collect the admin email/password, hostname, and public URL before invoking `scripts/setup_township.sh`.
- `scripts/setup_township.sh` – shared bootstrapper used both by the wizard and by advanced operators who prefer manual control.
- `scripts/township_diagnostics.sh` – post-deployment sanity checker that prints service health, database connectivity, and recent logs.

## Building an Image

1. Provision a clean Ubuntu/Debian VM (or use Packer) and clone this repository into `/opt/township`.
2. Install OS dependencies (Docker, Docker Compose plugin, python3). The first-boot wizard can also request this via `setup_township.sh --install-deps`.
3. Enable the wizard as a one-shot systemd service (example):

   ```ini
   # /etc/systemd/system/township-first-boot.service
   [Unit]
   Description=Run Township first-boot wizard
   ConditionPathExists=!/var/lib/township/appliance_state.json

   [Service]
   Type=oneshot
   ExecStart=/opt/township/appliance/first_boot.py
   StandardInput=tty
   TTYPath=/dev/tty1
   TTYReset=yes

   [Install]
   WantedBy=multi-user.target
   ```

4. Shut down the VM and export it as the format your towns expect (Scale HC3 template, VMware OVA, Hyper-V VHDX, etc.).

### Automated builds with Packer

To produce QCOW2/VMDK/VHDX/RAW artifacts in one shot:

```bash
cd appliance/packer
./build_all.sh
```

Requirements: HashiCorp Packer v1.10+, `qemu-img`, and enough disk space (~10 GB per artifact). The script:

- Uses Ubuntu 22.04 autoinstall to seed an OS with a pre-created `township` administrator account (password `township`, rotated on first boot).
- Installs Docker + prerequisites, copies the current repo into `/opt/township`, and enables the first-boot wizard.
- Emits images under `appliance/packer/build/`:
  - `*.qcow2` for KVM/Proxmox/Scale
  - `*.vmdk` for VMware/ESXi
  - `*.vhdx` for Hyper-V
  - `*.raw` for environments that need raw disks (convertible to Scale HC3 VDI)

You can then import each file into the target hypervisor or wrap it into its native template format (OVA, XVA, etc.).

## Operating the Appliance

1. Import the image into the town’s infrastructure and power it on.
2. On first boot, the console wizard appears:
   - Admin email + display name
   - Admin password (confirmed)
   - Hostname/APP_DOMAIN (e.g., `311.yourtown.gov`)
   - Public URL (used for reminders after bootstrap)
3. The wizard runs `scripts/setup_township.sh --reset …`, which:
   - Generates secure env defaults
   - Brings up the Docker Compose stack
   - Applies database migrations
   - Creates the admin account (or verifies credentials if it already exists)
4. Town staff can immediately browse to the supplied public URL and sign in—no extra shell steps required.

## Updates & Reset

- To apply a new software release, SSH into the appliance and run:

  ```bash
  cd /opt/township
  git pull origin main
  ./scripts/setup_township.sh --admin-email <existing email> --admin-password '<same password>' --admin-name "<display name>" --public-url https://311.yourtown.gov
  ```

  The script detects the existing admin account and simply verifies credentials while rebuilding the containers.

- To completely re-run the wizard (factory reset), remove `/var/lib/township/appliance_state.json` and reboot. This will also reset the Docker volumes, so ensure you have backups before doing so.

## Manual Alternative

Not every town can import appliances. For those cases, the existing manual workflow (clone repo + run `scripts/setup_township.sh`) remains available and fully documented in the root `README.md`. Both methods use the same underlying tooling, so switching between them is straightforward.
