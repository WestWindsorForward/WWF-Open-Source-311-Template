#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
OUTPUT_DIR="$SCRIPT_DIR/build"
QCOW="$OUTPUT_DIR/qemu/${PACKER_VM_NAME:-township-appliance}"

if ! command -v packer >/dev/null 2>&1; then
  echo "packer is required (https://developer.hashicorp.com/packer/downloads)"
  exit 1
fi

if ! command -v qemu-img >/dev/null 2>&1; then
  echo "qemu-img is required for format conversions."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Initializing Packer plugins..."
packer init "$SCRIPT_DIR/township.pkr.hcl"

echo "Building base QCOW2 image..."
packer build \
  -only=qemu.township \
  -var "repo_path=$REPO_ROOT" \
  "$SCRIPT_DIR/township.pkr.hcl"

QCOW_PATH="$OUTPUT_DIR/qemu/township-appliance"
if [[ ! -f "$QCOW_PATH" ]]; then
  echo "QCOW2 image not found at $QCOW_PATH"
  exit 1
fi

echo "Converting QCOW2 -> VMDK (VMware)..."
qemu-img convert -O vmdk "$QCOW_PATH" "$OUTPUT_DIR/township-appliance.vmdk"

echo "Converting QCOW2 -> VHDX (Hyper-V)..."
qemu-img convert -O vhdx "$QCOW_PATH" "$OUTPUT_DIR/township-appliance.vhdx"

echo "Converting QCOW2 -> RAW (Scale / generic KVM)..."
qemu-img convert -O raw "$QCOW_PATH" "$OUTPUT_DIR/township-appliance.raw"

echo
echo "Artifacts generated under $OUTPUT_DIR:"
ls -lh "$OUTPUT_DIR"
