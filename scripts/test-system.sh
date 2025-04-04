#!/bin/sh

ARGS="$@"
if [ -z "${ARGS}" ]; then
    ARGS='test/system/**/botSdk.spec.ts'
fi

TS_NODE_PROJECT=tsconfig-test.json mocha --recursive --exit --timeout 30000 -r ts-node/register $ARGS;