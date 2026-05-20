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
    AGENT_VIEW = "agent.view"
    AGENT_UPDATE = "agent.update"
    AGENT_PUBLISH = "agent.publish"
    AGENT_ARCHIVE = "agent.archive"
    AGENT_CLONE = "agent.clone"
    AGENT_TEST = "agent.test"
    AGENT_TRANSFER = "agent.transfer"
    AGENT_REVIEW = "agent.review"
    AGENT_HIRE = "agent.hire"
    # Bazaar / hire / review (Phase 3)
    HIRE_CREATE = "hire.create"
    HIRE_VIEW = "hire.view"
    REVIEW_CREATE = "review.create"
    REVIEW_VIEW = "review.view"
    BAZAAR_SEARCH = "bazaar.search"
    # Knowledge Base & RAG (Phase 4)
    KB_CREATE = "kb.create"
    KB_VIEW = "kb.view"
    KB_DELETE = "kb.delete"
    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_VIEW = "document.view"
    DOCUMENT_DELETE = "document.delete"
    KB_SEARCH = "kb.search"


class ResourceType(StrEnum):
    WORKSPACE = "workspace"
    MEMBERSHIP = "membership"
    API_KEY = "api_key"
    AGENT = "agent"
    AGENT_VERSION = "agent_version"
    HIRE = "hire"
    REVIEW = "review"
    CATEGORY = "category"
    # Phase 4
    KB = "knowledge_base"
    DOCUMENT = "document"


class Outcome(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"


class AgentStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Classification(StrEnum):
    PUBLIC = "public"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    CONFIDENTIAL = "confidential"


class AgentSource(StrEnum):
    YAML_UPLOAD = "yaml_upload"
    TEMPLATE = "template"
