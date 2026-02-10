use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostQueryRequest {
    pub method: String,
    #[serde(default)]
    pub params: Value,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostMutationRequest {
    pub method: String,
    #[serde(default)]
    pub params: Value,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostResponse {
    pub request_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<HostError>,
}

impl HostResponse {
    pub fn ok(request_id: impl Into<String>, result: Value) -> Self {
        Self {
            request_id: request_id.into(),
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    pub fn err(
        request_id: impl Into<String>,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            ok: false,
            result: None,
            error: Some(HostError {
                code: code.into(),
                message: message.into(),
                details: None,
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerRequest {
    pub worker_id: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerResponse {
    pub worker_id: String,
    pub request_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<HostError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentryInitOptions {
    pub codex_app_session_id: String,
    pub build_flavor: String,
    pub build_number: Option<String>,
    pub app_version: String,
}

#[derive(Debug, Clone)]
pub struct BridgeRequestEnvelope {
    pub id: Value,
    pub method: String,
    pub params: Value,
}

pub fn parse_bridge_request_payload(payload: Value) -> Result<BridgeRequestEnvelope, String> {
    let request = payload
        .get("request")
        .cloned()
        .unwrap_or_else(|| payload.clone());
    let id = request
        .get("id")
        .or_else(|| payload.get("id"))
        .cloned()
        .unwrap_or_else(|| Value::String(Uuid::new_v4().to_string()));
    let method = request
        .get("method")
        .or_else(|| payload.get("method"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| "request method is required".to_string())?;
    let params = request
        .get("params")
        .or_else(|| payload.get("params"))
        .cloned()
        .unwrap_or_else(|| json!({}));
    Ok(BridgeRequestEnvelope { id, method, params })
}

pub fn jsonrpc_success(id: Value, result: Value) -> Value {
    json!({
      "jsonrpc": "2.0",
      "id": id,
      "result": result
    })
}

pub fn jsonrpc_error(
    id: Value,
    code: impl Into<String>,
    message: impl Into<String>,
    details: Option<Value>,
) -> Value {
    let mut error = json!({
      "code": code.into(),
      "message": message.into()
    });
    if let Some(details) = details {
        error["details"] = details;
    }
    json!({
      "jsonrpc": "2.0",
      "id": id,
      "error": error
    })
}

pub fn id_to_key(id: &Value) -> String {
    match id {
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Null => "null".to_string(),
        _ => id.to_string(),
    }
}
