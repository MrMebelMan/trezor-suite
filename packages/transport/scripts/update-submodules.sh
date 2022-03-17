#!/usr/bin/env bash

set -euxo pipefail

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"
cd ../trezor-common
commit=$(git rev-parse --short HEAD)
echo $commit
git pull origin master
git add .
git commit -m "chore: update trezor-common ($commit)"
