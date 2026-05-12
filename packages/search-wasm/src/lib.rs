use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ── Input types (must match TS FilterQuery / Card interfaces) ─────

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FilterQuery {
    #[serde(default)]
    and: Vec<FilterRule>,
    #[serde(default)]
    not: Vec<FilterRule>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilterRule {
    field:    String,
    /// For multi-value inclusion (elements, classes, type…)
    values:   Option<Vec<String>>,
    /// For text contains checks (effectText, name…)
    contains: Option<String>,
    /// Numeric range
    gte: Option<f64>,
    lte: Option<f64>,
    eq:  Option<f64>,
    /// How to combine `values`: "AND" | "OR" (default OR)
    operator: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CardRelease {
    set_code:         String,
    set_name:         String,
    collector_number: String,
    language:         String,
    release_date:     Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Card {
    uuid:         String,
    name:         String,
    slug:         String,
    release:      CardRelease,
    #[serde(default)] elements:   Vec<String>,
    #[serde(default)] classes:    Vec<String>,
    #[serde(rename = "type")]
    card_type:    String,
    #[serde(default)] subtypes:   Vec<String>,
    reserve_cost: Option<f64>,
    memory_cost:  Option<f64>,
    effect_text:  Option<String>,
    flavor_text:  Option<String>,
    image_url:    Option<String>,
    rarity:       Option<String>,
}

// ── Exported WASM function ────────────────────────────────────────

/// Filter `cards_json` (JSON array of Card) using `query_json` (FilterQuery).
/// Returns a JSON array of matching cards.
///
/// Called from TypeScript as:
///   const result = JSON.parse(filter_cards(cardsJson, queryJson));
#[wasm_bindgen]
pub fn filter_cards(cards_json: &str, query_json: &str) -> String {
    let cards: Vec<Card> = match serde_json::from_str(cards_json) {
        Ok(v)  => v,
        Err(e) => return format!("{{\"error\":\"parse cards: {e}\"}}"),
    };
    let query: FilterQuery = match serde_json::from_str(query_json) {
        Ok(v)  => v,
        Err(e) => return format!("{{\"error\":\"parse query: {e}\"}}"),
    };

    let matched: Vec<&Card> = cards.iter().filter(|c| matches_query(c, &query)).collect();

    serde_json::to_string(&matched).unwrap_or_else(|_| "[]".to_string())
}

// ── Matching logic ────────────────────────────────────────────────

fn matches_query(card: &Card, query: &FilterQuery) -> bool {
    // Full-text search across name and effectText
    if let Some(text) = &query.text {
        let t = text.to_lowercase();
        if !t.is_empty() {
            let in_name = card.name.to_lowercase().contains(&t);
            let in_effect = card.effect_text.as_deref()
                .map_or(false, |e| e.to_lowercase().contains(&t));
            if !in_name && !in_effect {
                return false;
            }
        }
    }

    // AND rules — all must pass
    for rule in &query.and {
        if !apply_rule(card, rule, false) {
            return false;
        }
    }

    // NOT rules — none must pass
    for rule in &query.not {
        if apply_rule(card, rule, false) {
            return false;
        }
    }

    true
}

fn apply_rule(card: &Card, rule: &FilterRule, _negated: bool) -> bool {
    let use_and = rule.operator.as_deref() == Some("AND");

    match rule.field.as_str() {
        "elements" => {
            let Some(values) = &rule.values else { return true };
            if values.is_empty() { return true; }
            if use_and {
                values.iter().all(|v| card.elements.contains(v))
            } else {
                values.iter().any(|v| card.elements.contains(v))
            }
        }

        "classes" => {
            let Some(values) = &rule.values else { return true };
            if values.is_empty() { return true; }
            if use_and {
                values.iter().all(|v| card.classes.contains(v))
            } else {
                values.iter().any(|v| card.classes.contains(v))
            }
        }

        "type" => {
            let Some(values) = &rule.values else { return true };
            if values.is_empty() { return true; }
            values.iter().any(|v| v.eq_ignore_ascii_case(&card.card_type))
        }

        "reserveCost" | "reserve_cost" => {
            let cost = card.reserve_cost;
            if let Some(eq)  = rule.eq  { return cost == Some(eq); }
            if let Some(gte) = rule.gte { if cost.map_or(true, |c| c < gte)  { return false; } }
            if let Some(lte) = rule.lte { if cost.map_or(true, |c| c > lte)  { return false; } }
            true
        }

        "effectText" | "effect_text" => {
            let Some(contains) = &rule.contains else { return true };
            card.effect_text.as_deref()
                .map_or(false, |t| t.to_lowercase().contains(&contains.to_lowercase()))
        }

        "name" => {
            let Some(contains) = &rule.contains else { return true };
            card.name.to_lowercase().contains(&contains.to_lowercase())
        }

        _ => true, // unknown field → don't filter
    }
}
