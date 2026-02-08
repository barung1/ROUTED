#!/usr/bin/env bash
set -euo pipefail

env_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)"
source_file="$env_dir/env.template.txt"
dest_file="$env_dir/.env"

if [[ ! -f "$source_file" ]]; then
  echo "Missing template: $source_file" >&2
  exit 1
fi

if [[ -f "$dest_file" ]]; then
  echo "env/.env already exists. Delete it to re-create." >&2
  exit 0
fi

tmp_file="$dest_file.tmp"
> "$tmp_file"

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" || "$line" =~ ^# ]]; then
    echo "$line" >> "$tmp_file"
    continue
  fi

  if [[ "$line" == *"="* ]]; then
    key="${line%%=*}"
    default_value="${line#*=}"

    if [[ -n "$default_value" ]]; then
      prompt="$key [$default_value]: "
    else
      prompt="$key: "
    fi

    read -r -p "$prompt" input_value
    if [[ -z "$input_value" ]]; then
      input_value="$default_value"
    fi

    echo "$key=$input_value" >> "$tmp_file"
  else
    echo "$line" >> "$tmp_file"
  fi
done < "$source_file"

mv "$tmp_file" "$dest_file"
echo "Created env/.env from env/env.template.txt"
