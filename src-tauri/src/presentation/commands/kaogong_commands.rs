use std::sync::Arc;

use serde_json::{json, Value};
use tauri::State;

use crate::app::AppState;
use crate::presentation::commands::helpers::{log_command, map_command_error};
use crate::presentation::errors::CommandError;

const NAMESPACE: &str = "kaogong";
const TABLE: &str = "main";
const KEY: &str = "study-data";

fn validate_data(data: &Value) -> Result<(), CommandError> {
    let object = data.as_object().ok_or_else(|| {
        CommandError::BadRequest("Kaogong data must be a JSON object".to_string())
    })?;

    for field in ["checkins", "wrongQuestions"] {
        let entries = object
            .get(field)
            .and_then(Value::as_array)
            .ok_or_else(|| CommandError::BadRequest(format!("Kaogong {} must be an array", field)))?;
        if entries.len() > 10_000 {
            return Err(CommandError::BadRequest(format!("Kaogong {} is too large", field)));
        }
    }

    for checkin in object["checkins"].as_array().expect("validated array") {
        let item = checkin.as_object().ok_or_else(|| {
            CommandError::BadRequest("Each Kaogong checkin must be an object".to_string())
        })?;
        let subject = item.get("subject").and_then(Value::as_str).unwrap_or("").trim();
        if subject.is_empty() || subject.len() > 40 {
            return Err(CommandError::BadRequest("Invalid Kaogong subject".to_string()));
        }
        for field in ["totalQuestions", "wrongQuestions"] {
            let value = item.get(field).and_then(Value::as_u64).ok_or_else(|| {
                CommandError::BadRequest(format!("Kaogong {} must be a number", field))
            })?;
            if value > 100_000 {
                return Err(CommandError::BadRequest(format!("Kaogong {} is too large", field)));
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_kaogong_data(
    app_state: State<'_, Arc<AppState>>,
) -> Result<Value, CommandError> {
    log_command("get_kaogong_data");
    Ok(app_state
        .extension_store_service
        .try_get_json(NAMESPACE, Some(TABLE), KEY)
        .await
        .map_err(map_command_error("Failed to load Kaogong data"))?
        .unwrap_or_else(|| json!({ "version": 1, "checkins": [], "wrongQuestions": [] })))
}

#[tauri::command]
pub async fn save_kaogong_data(
    data: Value,
    app_state: State<'_, Arc<AppState>>,
) -> Result<(), CommandError> {
    log_command("save_kaogong_data");
    validate_data(&data)?;
    app_state
        .extension_store_service
        .set_json(NAMESPACE, Some(TABLE), KEY, data)
        .await
        .map_err(map_command_error("Failed to save Kaogong data"))
}

#[cfg(test)]
mod tests {
    use super::validate_data;
    use serde_json::json;

    #[test]
    fn validates_minimal_payload() {
        validate_data(&json!({
            "checkins": [{ "subject": "行测", "totalQuestions": 20, "wrongQuestions": 3 }],
            "wrongQuestions": []
        }))
        .expect("minimal payload should validate");
    }

    #[test]
    fn rejects_path_like_or_empty_subject() {
        assert!(validate_data(&json!({
            "checkins": [{ "subject": "../x", "totalQuestions": 1, "wrongQuestions": 0 }],
            "wrongQuestions": []
        }))
        .is_err());
    }
}
