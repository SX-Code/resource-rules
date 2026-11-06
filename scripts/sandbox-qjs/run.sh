#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/engines/quickjs-linux-x86_64/qjs" "$@"