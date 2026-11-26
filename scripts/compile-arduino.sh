#!/usr/bin/env bash
set -euo pipefail

# Compile-only evidence. This never uploads firmware or enables sensor/relay gates.
# Install Arduino CLI 1.6.0 first, then run: bash scripts/compile-arduino.sh [evidence-dir]
# Tool downloads/caches and default evidence live outside the checkout.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
arduino_cli="${DWMS_ARDUINO_CLI:-arduino-cli}"
work_dir="${DWMS_ARDUINO_WORK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/dwms-arduino.XXXXXX")}"
mkdir -p "$work_dir"
work_dir="$(cd "$work_dir" && pwd)"
evidence_dir="${1:-$work_dir/evidence}"
mkdir -p "$evidence_dir"
evidence_dir="$(cd "$evidence_dir" && pwd)"
config_file="$work_dir/arduino-cli.yaml"
sketch_dir="$repo_root/hardware/arduino/dwms_controller"
sketch_file="$sketch_dir/dwms_controller.ino"

cli_version="$("$arduino_cli" version)"
if [[ ! "$cli_version" =~ Version:[[:space:]]1\.6\.0[[:space:]] ]]; then
  echo "Arduino CLI 1.6.0 is required. Observed: $cli_version" >&2
  exit 1
fi

# Check the source defaults, then compile without -D overrides. A future enabled
# default must fail this compile-only CI path, rather than be masked by flags.
for gate in DWMS_SENSOR_CALIBRATION_CONFIGURED DWMS_RELAY_CONTROL_ENABLED; do
  if ! awk -v gate="$gate" '
    $1 == "#define" && $2 == gate { count++; if ($3 != "0" || NF != 3) bad = 1 }
    END { exit (count != 1 || bad) }
  ' "$sketch_file"; then
    echo "Expected exactly one disabled source default for $gate." >&2
    exit 1
  fi
done

if [[ ! -f "$config_file" ]]; then
  "$arduino_cli" config init --dest-dir "$work_dir"
fi
"$arduino_cli" config set directories.data "$work_dir/data" --config-file "$config_file"
"$arduino_cli" config set directories.user "$work_dir/user" --config-file "$config_file"
# CLI's downloader needs its own proxy setting on managed computers. Preserve
# the inherited proxy and TLS trust, and never print its URL/credentials.
if [[ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]]; then
  "$arduino_cli" config set network.proxy "${HTTPS_PROXY:-${https_proxy:-}}" --config-file "$config_file"
fi
"$arduino_cli" core update-index --config-file "$config_file"
"$arduino_cli" lib update-index --config-file "$config_file"
"$arduino_cli" core install arduino:avr@1.8.6 --config-file "$config_file"
"$arduino_cli" lib install 'LiquidCrystal I2C@1.1.2' --config-file "$config_file"

compiler="$work_dir/data/packages/arduino/tools/avr-gcc/7.3.0-atmel3.6.1-arduino7/bin/avr-g++"
{
  printf '%s\n' "$cli_version"
  "$compiler" --version
  "$arduino_cli" core list --config-file "$config_file"
  "$arduino_cli" lib list --config-file "$config_file"
  printf '%s\n' 'FQBN: arduino:avr:uno' 'Source defaults: calibration=0, relay=0' 'Compiler command: compile --clean --fqbn arduino:avr:uno --warnings all (no build-property overrides)'
} > "$evidence_dir/toolchain.txt"
cat "$evidence_dir/toolchain.txt"

"$arduino_cli" compile --clean --fqbn arduino:avr:uno --warnings all \
  --build-path "$work_dir/build" --output-dir "$evidence_dir" \
  --config-file "$config_file" "$sketch_dir" 2>&1 | tee "$evidence_dir/compile.log"
(
  cd "$evidence_dir"
  sha256sum dwms_controller.ino.hex > firmware.sha256
  cat firmware.sha256
)
(
  cd "$repo_root"
  sha256sum hardware/arduino/dwms_controller/dwms_controller.ino scripts/compile-arduino.sh
) > "$evidence_dir/source.sha256"
printf 'Arduino Uno compile evidence: %s\n' "$evidence_dir"
printf '%s\n' 'No board upload, sensor calibration, relay actuation, or physical validation was performed.'
