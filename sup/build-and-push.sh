#!/bin/bash
#shellcheck disable=SC2086
#
#  Build and push the docker container
#
set -e

version=$(git rev-parse --short HEAD)
image_tag=canarymonitor/sup:$version

make release
docker tag sup:$version $image_tag
docker push $image_tag

if [ "$1" == "--with-latest" ]
then
    latest_tag=canarymonitor/sup:latest
    docker tag $image_tag $latest_tag
    docker push $latest_tag
fi

cat <<EOF

Build data:

`cat priv/build.txt`

EOF
