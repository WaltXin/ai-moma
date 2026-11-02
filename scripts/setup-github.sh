#!/usr/bin/env bash
# One-time (idempotent) GitHub repository setup for AI MoMA.
# Requires: gh CLI authenticated as a repo admin.
#   ./scripts/setup-github.sh            # uses the current repo
#   REPO=owner/name ./scripts/setup-github.sh
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
echo "Configuring $REPO"

echo "→ Merge settings: squash only, PR title as commit message, auto-delete branches"
gh api -X PATCH "repos/$REPO" --silent \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true -F allow_auto_merge=true \
  -F has_discussions=true -F has_issues=true

echo "→ Private vulnerability reporting"
gh api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent

echo "→ Labels"
label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; }
label "triage"            "ededed" "Needs a maintainer to look at it"
label "bug"               "d73a4a" "Something isn't working"
label "enhancement"       "a2eeef" "New feature or request"
label "breaking"          "b60205" "Breaking change"
label "content"           "ff2e63" "Movements, exhibitions, floors, learn text"
label "generation"        "5319e7" "Image providers and the generation pipeline"
label "studio"            "fbca04" "Studio and exhibition requests"
label "gallery"           "0e8a16" "Floors, exhibitions, viewers"
label "documentation"     "0075ca" "Docs"
label "ci"                "c5def5" "GitHub Actions and tooling"
label "tests"             "bfd4f2" "Tests"
label "dependencies"      "0366d6" "Dependency updates"
label "good first issue"  "7057ff" "Good for newcomers"
label "help wanted"       "008672" "Extra attention is needed"
label "skip-changelog"    "ffffff" "Leave out of release notes"

echo "→ Ruleset for the default branch"
RULESET=$(cat <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "check" }, { "context": "Validate PR title" }]
      }
    }
  ]
}
JSON
)
EXISTING=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main") | .id')
if [[ -n "$EXISTING" ]]; then
  echo "$RULESET" | gh api -X PUT "repos/$REPO/rulesets/$EXISTING" --input - --silent
else
  echo "$RULESET" | gh api -X POST "repos/$REPO/rulesets" --input - --silent
fi

echo "✓ Done. Review at https://github.com/$REPO/settings"
