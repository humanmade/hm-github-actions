#!/usr/bin/env bash
#
# List installed third-party plugin/theme directories whose Composer package was added or
# changed relative to a base git ref.
#
# Third-party plugins and themes are gitignored (installed by Composer at build time), so
# they never appear in a pull request's file diff. The signal that one was added or updated
# is a change to its entry in composer.lock.
#
# This script diffs the WordPress plugin/muplugin/theme packages in composer.lock between
# the base ref and the working tree, then maps each changed package to its installed
# directory (which must already be present — run `composer install` first).
#
# A package counts as changed if its name is new, its version differs, or its resolved
# commit reference differs (i.e., we check whether branch-level package references like
# `dev-main` without any specific version string resolve to a different commit SHA).
#
# Usage:  changed-plugins.sh <base-git-ref> [changed-identities-file]
# Output: one plugin/theme directory path per line; empty if nothing changed. If a second
#         argument is given, the changed name@version@reference identities are also written
#         to that path, so a caller can fingerprint exactly which package versions changed.

set -euo pipefail

BASE_REF="${1:?Usage: changed-plugins.sh <base-git-ref> [changed-identities-file]}"
IDENTITIES_FILE="${2:-}"

# Identity = name@version@reference for each WordPress plugin/muplugin/theme package.
wp_package_identities() {
	jq -r '.packages[]
		| select( .type == "wordpress-plugin" or .type == "wordpress-muplugin" or .type == "wordpress-theme" )
		| "\(.name)@\(.version)@\(.dist.reference // .source.reference // "")"'
}

base_identities="$( git show "${BASE_REF}:composer.lock" 2>/dev/null | wp_package_identities | sort || true )"
head_identities="$( wp_package_identities < composer.lock | sort )"

# Identities in HEAD but not in BASE = added, version-changed, or ref-changed.
changed_identities="$(
	comm -13 \
		<( printf '%s\n' "${base_identities}" ) \
		<( printf '%s\n' "${head_identities}" )
)"

# The identity list is a fingerprint of the exact package versions under review, which the
# caller can use to recognize a set of changes it has already reported on.
if [ -n "${IDENTITIES_FILE}" ]; then
	printf '%s\n' "${changed_identities}" > "${IDENTITIES_FILE}"
fi

changed_packages="$( printf '%s\n' "${changed_identities}" | sed 's/@.*//' | sort -u )"

[ -z "${changed_packages}" ] && exit 0

# Map each "vendor/name" package to its installed directory.
while IFS= read -r package; do
	[ -z "${package}" ] && continue
	short_name="${package##*/}"
	# The install root (plugins/, client-mu-plugins/, mu-plugins/, themes/) is governed
	# by Composer's installer-paths, but we can simply check in each folder to find it.
	for root in client-mu-plugins mu-plugins plugins themes; do
		if [ -d "${root}/${short_name}" ]; then
			printf '%s\n' "${root}/${short_name}"
		fi
	done
done <<< "${changed_packages}"
