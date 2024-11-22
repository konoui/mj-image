#!/bin/bash

PROFILE=$1
if [ -n "$PROFILE" ]; then
    echo using profile $PROFLE
    export AWS_PROFILE=$PROFILE
fi

# https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Expiration.html
# max-age: for cdn, 30 days
# s-maxage: for browsre, 5 days
aws s3 sync ./dist/browser/ s3://static.konoui.dev/mjimage/ --delete --cache-control max-age=2592000,s-maxage=432000,stale-while-revalidate=432000
aws s3 cp ./example/index.html s3://static.konoui.dev/mjimage/example/index.html
