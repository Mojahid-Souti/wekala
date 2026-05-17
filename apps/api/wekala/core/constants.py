from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    BUILDER = "builder"
    REVIEWER = "reviewer"
    HIRER = "hirer"
    VIEWER = "viewer"


# Ordered by privilege level (index = rank)
ROLE_RANK: dict[Role, int] = {
    Role.VIEWER: 0,
    Role.HIRER: 1,
    Role.REVIEWER: 2,
    Role.BUILDER: 3,
    Role.ADMIN: 4,
}


class Action(StrEnum):
    WORKSPACE_VIEW = "workspace.view"
    WORKSPACE_UPDATE = "workspace.update"
    WORKSPACE_INVITE = "workspace.invite"
    MEMBERSHIP_UPDATE = "membership.update"
    API_KEY_MANAGE = "api_key.manage"
    AGENT_CREATE = "agent.create"
    AGENT_PUBLISH = "agent.publish"
    AGENT_REVIEW = "agent.review"
    AGENT_HIRE = "agent.hire"


class ResourceType(StrEnum):
    WORKSPACE = "workspace"
    MEMBERSHIP = "membership"
    API_KEY = "api_key"
    AGENT = "agent"


class Outcome(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
