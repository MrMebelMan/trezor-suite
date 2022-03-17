#!/usr/bin/env bash

set -euxo pipefail

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

SRC=$1 # '../trezor-common/protob'
DIST=$2 # '../src'


# BUILD combined messages.proto file from protobuf files
# this code was copied from ./submodules/trezor-common/protob Makekile
# clear protobuf syntax and remove unknown values to be able to work with proto2js
echo 'syntax = "proto2";' > $DIST/messages.proto
echo 'import "google/protobuf/descriptor.proto";' >> $DIST/messages.proto
echo "Build proto file from $SRC"
grep -hv -e '^import ' -e '^syntax' -e '^package' -e 'option java_' $SRC/messages*.proto \
| sed 's/ hw\.trezor\.messages\.common\./ /' \
| sed 's/ common\./ /' \
| sed 's/ management\./ /' \
| sed 's/^option /\/\/ option /' \
| grep -v '    reserved '>> $DIST/messages.proto

# BUILD messages.json from message.proto
../node_modules/.bin/pbjs -t json -p $DIST -o $DIST/messages.json --keep-case messages.proto
rm $DIST/messages.proto

echo $3
if [[ $# -le 2  || "$3" != "typescript" && "$3" != "flow" ]];
    then
        echo "either typescript or flow must be specified as the third argument"
        exit 1
fi

if [ "$3" == "typescript" ]
    then
        node ./protobuf-types.js typescript
fi

if [ "$3" == "flow" ]
    then
        node ./protobuf-types.js
fi
