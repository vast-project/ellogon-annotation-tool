#!/bin/bash
set -e

echo "Container's IP address: `awk 'END{print $1}' /etc/hosts`"

exec "$@"
