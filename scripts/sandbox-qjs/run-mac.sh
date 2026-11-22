#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/engines/quickjs-mac-arm64/qjs" "$@"