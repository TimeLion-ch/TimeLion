#!/usr/bin/env bash
#
# Uploads a release directory to an FTP-only webspace, then runs the database migrations through
# POST /api/deploy/migrate, authorized by a one-time token (see src/Deploy/DeployToken.php).
#
# The deploy job in .github/workflows/ci.yml runs this. It also works locally (needs lftp, curl and openssl):
#
#   LFTP_PASSWORD=… DEPLOY_FTP_HOST=… DEPLOY_FTP_USER=… DEPLOY_FTP_PATH=… DEPLOY_URL=… \
#     bash .github/scripts/deploy-ftp.sh release
#
# Optional: DEPLOY_FTP_PORT (default 21), DEPLOY_FTP_CA_FILE (CA bundle for verifying the server certificate).

set -euo pipefail

release=$(cd "${1:?Usage: deploy-ftp.sh <release directory>}" && pwd)
: "${DEPLOY_FTP_HOST:?must be set}" "${DEPLOY_FTP_USER:?must be set}" "${DEPLOY_FTP_PATH:?must be set}"
: "${DEPLOY_URL:?must be set}" "${LFTP_PASSWORD:?must be set (the FTP password)}"

work=$(mktemp -d)
token_uploaded=false

# Runs the lftp commands from stdin in a new session. TLS is mandatory for the login and all transfers, and the
# certificate must be valid for DEPLOY_FTP_HOST: there is no fallback to plain FTP.
ftp() {
	{
		cat <<-EOF
			set cmd:fail-exit yes
			set net:timeout 30
			set net:max-retries 3
			set net:reconnect-interval-base 5
			set ftp:ssl-force yes
			set ftp:ssl-protect-data yes
			set ftp:ssl-protect-list yes
			set ssl:verify-certificate yes
			set ssl:check-hostname yes
			${DEPLOY_FTP_CA_FILE:+set ssl:ca-file "$DEPLOY_FTP_CA_FILE"}
			set ftp:list-options -a
			set xfer:use-temp-file yes
			open --env-password -u "$DEPLOY_FTP_USER" -p "${DEPLOY_FTP_PORT:-21}" "ftp://$DEPLOY_FTP_HOST"
			cd "$DEPLOY_FTP_PATH"
		EOF
		cat
	} >"$work/session.lftp"
	lftp -f "$work/session.lftp"
}

cleanup() {
	if [ "$token_uploaded" = true ]; then
		# The server deletes the token file when it accepts the token; this covers a failed or skipped call.
		echo 'rm -f var/deploy-token' | ftp || echo "::warning::Could not delete var/deploy-token on the server."
	fi
	rm -rf "$work"
}
trap cleanup EXIT

# A fresh token for every deploy: 32 random bytes, base64url. Only its SHA-256 hash goes to the server.
token=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')
if [ -n "${GITHUB_ACTIONS:-}" ]; then
	echo "::add-mask::$token"
fi
printf '%s' "$token" | openssl dgst -sha256 -r | cut -d' ' -f1 >"$work/deploy-token"
printf 'Authorization: Bearer %s\n' "$token" >"$work/auth-header"

echo "Uploading $release to $DEPLOY_FTP_HOST:$DEPLOY_FTP_PATH"
cd "$release"
# Every file is uploaded under a temporary name and renamed when complete, so no request sees a half-written file.
# --delete spares the excluded server-owned files: config.php, the contents of var/ and what the host puts into
# public/. index.html and .htaccess go up last and back to back, because the CSP in .htaccess holds the hashes of
# the inline code in index.html.
ftp <<EOF
mirror --reverse --delete --parallel=3 --verbose --exclude '^config\.php\$' --exclude '^var/.' --exclude '^public/\.well-known/' --exclude '^public/\.user\.ini\$' --exclude '^public/index\.html\$' --exclude '^public/\.htaccess\$' . .
put public/.htaccess -o public/.htaccess
put public/index.html -o public/index.html
put "$work/deploy-token" -o var/deploy-token
EOF
token_uploaded=true

echo "Running database migrations"
if ! result=$(curl --silent --show-error --fail-with-body --request POST --header "@$work/auth-header" \
	"${DEPLOY_URL%/}/api/deploy/migrate"); then
	echo "::error::Migrations failed: $result"
	exit 1
fi
echo "Migrations: $result"
