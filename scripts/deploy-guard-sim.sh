#!/bin/sh
# Local simulation of deploy.yml step 2: rsync with the workflow's ARGS and EXCLUDE list, no SSH.
# Proves the rsync semantics only; the real test is on a test folder on the host.
# Works in a fresh mktemp directory under /tmp, left for the OS to clear.
set -eu
T=$(mktemp -d)
mkdir -p "$T/src/handler" "$T/remote/handler" "$T/remote/log" "$T/remote/ratelimit"
echo "new handler" > "$T/src/handler/index.php"
echo "<?php // hand-placed secret" > "$T/remote/config.php"
echo "2026-11-19T00:00Z sent research" > "$T/remote/log/handler.log"
echo "hash,1,0" > "$T/remote/ratelimit/store.csv"
echo "old handler" > "$T/remote/handler/index.php"
echo "stale" > "$T/remote/handler/removed-in-repo.php"
echo "--- remote before"; (cd "$T/remote" && find . -type f | sort)
rsync -rlgoDzvc -i --delete --exclude /config.php --exclude /log/ --exclude /ratelimit/ "$T/src/" "$T/remote/" | sed 's/^/  rsync: /'
echo "--- remote after"; (cd "$T/remote" && find . -type f | sort)
echo "--- contents"; for f in config.php log/handler.log ratelimit/store.csv handler/index.php; do printf '%s: ' "$f"; cat "$T/remote/$f"; done
if test -f "$T/remote/config.php" && test -f "$T/remote/log/handler.log" && test -f "$T/remote/ratelimit/store.csv" \
  && test ! -e "$T/remote/handler/removed-in-repo.php" && grep -q "new handler" "$T/remote/handler/index.php"; then
  echo "DEPLOY GUARD SIM PASS"
else
  echo "DEPLOY GUARD SIM FAIL"
fi
