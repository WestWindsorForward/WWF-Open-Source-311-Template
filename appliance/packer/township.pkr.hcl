packer {
  required_plugins {
    qemu = {
      version = ">= 1.1.0"
      source  = "github.com/hashicorp/qemu"
    }
  }
}

variable "iso_url" {
  type    = string
  default = "https://releases.ubuntu.com/22.04/ubuntu-22.04.5-live-server-amd64.iso"
}

variable "iso_checksum" {
  type    = string
  default = "sha256:cd2a4df9cb68c79d536e4739d0651d93ae79ea52852c088cc6305cc2034814bb"
}

variable "repo_path" {
  type    = string
  default = "../../"
}

variable "vm_name" {
  type    = string
  default = "township-appliance"
}

variable "disk_size" {
  type    = number
  default = 30720
}

locals {
  ssh_username = "township"
  ssh_password = "township"
}

source "qemu" "township" {
  iso_url          = var.iso_url
  iso_checksum     = var.iso_checksum
  output_directory = "${path.root}/build/qemu"
  accelerator      = "kvm"
  shutdown_command = "echo '${local.ssh_password}' | sudo -S shutdown -P now"
  headless         = true
  cpus             = 2
  memory           = 4096
  disk_size        = var.disk_size
  format           = "qcow2"
  vm_name          = var.vm_name
  http_directory   = "${path.root}/http"

  ssh_username          = local.ssh_username
  ssh_password          = local.ssh_password
  ssh_timeout           = "30m"
  ssh_handshake_attempts = 50

  boot_wait = "5s"
  boot_command = [
    "<esc><wait>",
    "linux /casper/vmlinuz --- autoinstall ds='nocloud-net;seedfrom=http://{{ .HTTPIP }}:{{ .HTTPPort }}/' ",
    "console=ttyS0,115200n8 ",
    "<enter>",
    "initrd /casper/initrd<enter>",
    "boot<enter>"
  ]
}

build {
  sources = ["source.qemu.township"]

  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y --no-install-recommends curl jq python3 python3-venv python3-pip git ca-certificates apt-transport-https software-properties-common gnupg lsb-release",
      "sudo install -m 0755 -d /etc/apt/keyrings",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
      "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable\" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null",
      "sudo apt-get update",
      "sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin qemu-guest-agent",
      "sudo usermod -aG docker ${local.ssh_username}",
      "sudo systemctl enable docker"
    ]
  }

  provisioner "file" {
    source      = var.repo_path
    destination = "/home/${local.ssh_username}/township-src"
  }

  provisioner "shell" {
    inline = [
      "sudo rm -rf /opt/township",
      "sudo mv /home/${local.ssh_username}/township-src /opt/township",
      "sudo chown -R root:root /opt/township",
      "sudo find /opt/township/scripts -type f -name '*.sh' -exec chmod +x {} +",
      "sudo chmod +x /opt/township/appliance/first_boot.py /opt/township/scripts/township_diagnostics.sh /opt/township/scripts/setup_township.sh",
      "sudo mkdir -p /var/lib/township"
    ]
  }

  provisioner "shell" {
    inline = [
      "cat <<'EOF' | sudo tee /etc/systemd/system/township-first-boot.service >/dev/null",
      "[Unit]",
      "Description=Township first-boot wizard",
      "ConditionPathExists=!/var/lib/township/appliance_state.json",
      "After=network-online.target docker.service",
      "",
      "[Service]",
      "Type=simple",
      "WorkingDirectory=/opt/township",
      "ExecStart=/usr/bin/python3 /opt/township/appliance/first_boot.py",
      "Restart=no",
      "StandardInput=tty-force",
      "TTYPath=/dev/tty1",
      "TTYReset=yes",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",
      "sudo systemctl enable township-first-boot.service"
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo rm -rf /home/${local.ssh_username}/township-src",
      "sudo apt-get clean",
      "sudo cloud-init clean",
      "sudo truncate -s 0 /var/log/wtmp /var/log/btmp",
      "sudo rm -rf /tmp/* /var/tmp/*"
    ]
  }
}
