use serde_json::{json, Value};

pub const QUERY_METHODS: &[&str] = &[
    "account-info",
    "active-workspace-roots",
    "child-processes",
    "codex-home",
    "extension-info",
    "find-files",
    "get-configuration",
    "get-global-state",
    "gh-cli-status",
    "gh-pr-status",
    "git-origins",
    "has-custom-cli-executable",
    "ide-context",
    "inbox-items",
    "is-copilot-api-available",
    "list-automations",
    "list-pending-automation-run-threads",
    "list-pinned-threads",
    "local-environment",
    "local-environments",
    "locale-info",
    "open-in-targets",
    "os-info",
    "paths-exist",
    "pending-automation-runs",
    "read-file",
    "read-file-binary",
    "read-git-file-binary",
    "recommended-skills",
    "third-party-notices",
    "workspace-root-options",
];

pub const MUTATION_METHODS: &[&str] = &[
    "add-workspace-root-option",
    "apply-patch",
    "automation-create",
    "automation-delete",
    "automation-run-delete",
    "automation-run-now",
    "automation-update",
    "generate-pull-request-message",
    "generate-thread-title",
    "gh-pr-create",
    "git-checkout-branch",
    "git-create-branch",
    "git-push",
    "install-recommended-skill",
    "local-environment-config-save",
    "open-file",
    "remove-skill",
    "set-configuration",
    "set-global-state",
    "set-preferred-app",
    "terminal-attach",
    "terminal-close",
    "terminal-create",
    "terminal-resize",
    "terminal-write",
];

pub fn is_known_query_method(method: &str) -> bool {
    QUERY_METHODS.contains(&method)
}

pub fn is_known_mutation_method(method: &str) -> bool {
    MUTATION_METHODS.contains(&method)
}

pub fn all_known_methods() -> Vec<String> {
    let mut methods = QUERY_METHODS
        .iter()
        .chain(MUTATION_METHODS.iter())
        .map(|value| (*value).to_string())
        .collect::<Vec<_>>();
    methods.sort();
    methods.dedup();
    methods
}

pub fn dispatch_registry() -> Value {
    json!({
      "queryMethods": QUERY_METHODS,
      "mutationMethods": MUTATION_METHODS
    })
}

pub fn translated_app_server_method(method: &str, params: &Value) -> Option<(String, Value)> {
    match method {
        "account-info" => Some(("account/read".to_string(), json!({}))),
        "recommended-skills" => Some(("skills/list".to_string(), json!({}))),
        "generate-thread-title" => Some((
            "thread/list".to_string(),
            json!({
              "cursor": Value::Null,
              "limit": 1
            }),
        )),
        "generate-pull-request-message" => Some((
            "thread/read".to_string(),
            json!({
              "threadId": params
                .get("threadId")
                .or_else(|| params.get("thread_id"))
                .cloned()
                .unwrap_or(Value::Null)
            }),
        )),
        _ => None,
    }
}
