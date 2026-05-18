package wekala.authz

# Role hierarchy: higher rank = more permissions.
# n = number of roles (5); rank lookup is O(1) map access.
role_rank := {
  "viewer":   0,
  "hirer":    1,
  "reviewer": 2,
  "builder":  3,
  "admin":    4,
}

# Minimum role required for each action.
# Source of truth for all Phase 1+2 authorization decisions.
min_role := {
  "workspace.view":    "viewer",
  "workspace.update":  "admin",
  "workspace.invite":  "admin",
  "membership.view":   "viewer",
  "membership.update": "admin",
  "membership.remove": "admin",
  "api_key.view":      "admin",
  "api_key.manage":    "admin",
  # Agent lifecycle (Phase 2)
  "agent.create":      "builder",
  "agent.view":        "viewer",
  "agent.update":      "builder",
  "agent.publish":     "builder",
  "agent.archive":     "builder",
  "agent.clone":       "builder",
  "agent.test":        "builder",
  "agent.transfer":    "admin",
  # Bazaar / review / hire (Phase 3)
  "agent.review":      "reviewer",
  "agent.hire":        "hirer",
  "bazaar.search":     "viewer",
  "hire.create":       "hirer",
  "hire.view":         "viewer",
  "review.create":     "hirer",
  "review.view":       "viewer",
}

# default deny
default allow := false

# allow when the caller's role rank >= the required role rank for the action
allow {
  required := min_role[input.action]
  role_rank[input.role] >= role_rank[required]
}
