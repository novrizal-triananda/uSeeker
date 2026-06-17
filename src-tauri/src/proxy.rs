use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::command;

// ── Compile-time embedded keys (from CI / GitHub Secrets) ──

const EMBEDDED_AI_KEY: Option<&str> = option_env!("USEEKER_AI_API_KEY");
const EMBEDDED_AI_BASE: Option<&str> = option_env!("USEEKER_AI_BASE_URL");
const EMBEDDED_AI_MODEL: Option<&str> = option_env!("USEEKER_AI_MODEL");
const EMBEDDED_BRAVE_KEY: Option<&str> = option_env!("USEEKER_BRAVE_API_KEY");
const EMBEDDED_BING_KEY: Option<&str> = option_env!("USEEKER_BING_API_KEY");

// ── Runtime config resolution ──
// Priority: runtime override > env var > embedded compile-time > default

fn resolve_ai_key(runtime: Option<&str>) -> Option<String> {
    runtime
        .filter(|s| !s.is_empty())
        .map(String::from)
        .or_else(|| std::env::var("USEEKER_AI_API_KEY").ok().filter(|s| !s.is_empty()))
        .or_else(|| EMBEDDED_AI_KEY.map(String::from))
}

fn resolve_ai_base_url(runtime: Option<&str>) -> String {
    runtime
        .filter(|s| !s.is_empty())
        .map(String::from)
        .or_else(|| std::env::var("USEEKER_AI_BASE_URL").ok().filter(|s| !s.is_empty()))
        .or_else(|| EMBEDDED_AI_BASE.map(String::from))
        .unwrap_or_else(|| "https://api.deepseek.com".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn resolve_ai_model(runtime: Option<&str>) -> String {
    runtime
        .filter(|s| !s.is_empty())
        .map(String::from)
        .or_else(|| std::env::var("USEEKER_AI_MODEL").ok().filter(|s| !s.is_empty()))
        .or_else(|| EMBEDDED_AI_MODEL.map(String::from))
        .unwrap_or_else(|| "deepseek-chat".to_string())
}

fn resolve_brave_key() -> Option<String> {
    std::env::var("USEEKER_BRAVE_API_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| EMBEDDED_BRAVE_KEY.map(String::from))
}

fn resolve_bing_key() -> Option<String> {
    std::env::var("USEEKER_BING_API_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| EMBEDDED_BING_KEY.map(String::from))
}

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .expect("Failed to create HTTP client")
    })
}

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScrapeResult {
    pub text: String,
    pub links: Vec<LinkItem>,
    pub length: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkItem {
    pub url: String,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentStep {
    pub iteration: usize,
    pub tool: Option<String>,
    #[serde(rename = "toolInput")]
    pub tool_input: serde_json::Value,
    #[serde(rename = "toolOutput")]
    pub tool_output: Option<String>,
    pub reasoning: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentResult {
    pub result: String,
    pub steps: Vec<AgentStep>,
    #[serde(rename = "tokensUsed")]
    pub tokens_used: u64,
    pub duration: u64,
    pub success: bool,
}

// ── Tauri Commands ──

/// Call AI API (Deepseek / OpenRouter / any OpenAI-compatible).
/// Returns { result, task } matching the old Node.js server contract.
#[command]
pub async fn call_ai(
    prompt: String,
    system_prompt: Option<String>,
    task: Option<String>,
    api_key: Option<String>,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    let key = resolve_ai_key(api_key.as_deref())
        .ok_or("AI API key tidak dikonfigurasi")?;
    let base = resolve_ai_base_url(base_url.as_deref());
    let mdl = resolve_ai_model(model.as_deref());

    let mut messages: Vec<serde_json::Value> = Vec::new();
    if let Some(sp) = system_prompt {
        messages.push(serde_json::json!({ "role": "system", "content": sp }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": prompt }));

    let body = serde_json::json!({
        "model": mdl,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 8192,
    });

    let resp = http_client()
        .post(format!("{}/chat/completions", base))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI request error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("AI API error ({}): {}", status, err_text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("AI response parse error: {}", e))?;

    let result = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(serde_json::json!({ "result": result, "task": task }))
}

/// Multi-provider web search with automatic fallback.
/// Order: DuckDuckGo (free) → Brave (API) → Bing (API).
#[command]
pub async fn search_web(query: String) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Err("query is required".to_string());
    }

    // 1. DuckDuckGo (free, unlimited — but blocked by Indonesian ISPs)
    if let Some(results) = search_duckduckgo(&query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // 2. Brave Search API
    if let Some(results) = search_brave(&query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // 3. Bing Web Search API
    if let Some(results) = search_bing(&query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    Ok(vec![])
}

/// Fetch and extract text content from a URL (HTML → plain text).
#[command]
pub async fn fetch_url(url: String) -> Result<serde_json::Value, String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL")?;
    if !["http", "https"].contains(&parsed.scheme()) {
        return Err("Only http/https URLs allowed".to_string());
    }

    let resp = http_client()
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; uSeeker/2.0)")
        .header("Accept", "text/html,application/xhtml+xml,text/plain")
        .send()
        .await
        .map_err(|e| format!("Fetch error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Fetch failed: {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let raw = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    let text = strip_html(&raw, &content_type, 3000);
    let len = text.len();

    Ok(serde_json::json!({ "text": text, "length": len }))
}

/// Scrape a URL: returns cleaned text + extracted links.
/// Used by company research for multi-page crawling.
#[command]
pub async fn scrape_url(url: String) -> Result<ScrapeResult, String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL")?;
    if !["http", "https"].contains(&parsed.scheme()) {
        return Err("Only http/https URLs allowed".to_string());
    }

    let resp = http_client()
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; uSeeker/2.0)")
        .header("Accept", "text/html,application/xhtml+xml,text/plain")
        .send()
        .await
        .map_err(|e| format!("Fetch error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Fetch failed: {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let raw = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    // Extract links from raw HTML
    let links = if content_type.contains("text/html") {
        extract_links_from_html(&raw, &url)
    } else {
        vec![]
    };

    let text = strip_html(&raw, &content_type, 5000);
    let length = text.len();

    Ok(ScrapeResult {
        text,
        links: links.into_iter().take(30).collect(),
        length,
    })
}

/// Check for updates via GitHub Releases API.
/// Returns { updateAvailable, latestVersion, currentVersion, downloadUrl, body }.
#[command]
pub async fn check_update(
    repo_owner: String,
    repo_name: String,
    current_version: String,
) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        repo_owner, repo_name
    );

    let resp = http_client()
        .get(&url)
        .header("User-Agent", "uSeeker/2.0")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Update check failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        return Err(format!("GitHub API error ({})", status));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Response parse error: {}", e))?;

    let tag = data["tag_name"].as_str().unwrap_or("");
    let latest_version = tag.trim_start_matches('v');
    let body = data["body"].as_str().unwrap_or("");
    let html_url = data["html_url"].as_str().unwrap_or("");

    // Find download URL for current platform
    let download_url = find_platform_download(&data, html_url);

    let update_available = version_gt(latest_version, &current_version);

    Ok(serde_json::json!({
        "updateAvailable": update_available,
        "latestVersion": latest_version,
        "currentVersion": current_version,
        "downloadUrl": download_url,
        "releaseUrl": html_url,
        "releaseNotes": body,
    }))
}

fn find_platform_download(release: &serde_json::Value, fallback_url: &str) -> String {
    let assets = match release["assets"].as_array() {
        Some(a) => a,
        None => return fallback_url.to_string(),
    };

    let ext_patterns: &[&str] = if cfg!(target_os = "windows") {
        &[".msi"]
    } else if cfg!(target_os = "macos") {
        &[".dmg"]
    } else {
        &[".AppImage", ".deb"]
    };

    for ext in ext_patterns {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            let url = asset["browser_download_url"].as_str().unwrap_or("");
            if name.to_lowercase().contains(ext) && !url.is_empty() {
                return url.to_string();
            }
        }
    }

    fallback_url.to_string()
}

/// Compare semver strings: returns true if a > b.
fn version_gt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .filter_map(|p| p.parse().ok())
            .collect()
    };
    let va = parse(a);
    let vb = parse(b);
    for i in 0..std::cmp::max(va.len(), vb.len()) {
        let a_part = va.get(i).copied().unwrap_or(0);
        let b_part = vb.get(i).copied().unwrap_or(0);
        if a_part > b_part {
            return true;
        }
        if a_part < b_part {
            return false;
        }
    }
    false
}

/// Health check — returns config status (no secrets exposed).
#[command]
pub fn check_health() -> serde_json::Value {
    let ai_key = resolve_ai_key(None);
    serde_json::json!({
        "status": "ok",
        "ai": {
            "configured": ai_key.is_some(),
            "provider": if ai_key.is_some() { Some(resolve_ai_base_url(None)) } else { None },
            "model": if ai_key.is_some() { Some(resolve_ai_model(None)) } else { None },
        },
        "search": {
            "providers": [
                { "name": "DuckDuckGo", "type": "free", "available": true },
                { "name": "Brave", "type": "api", "available": resolve_brave_key().is_some() },
                { "name": "Bing", "type": "api", "available": resolve_bing_key().is_some() },
            ]
        },
        "timestamp": chrono_now(),
    })
}

/// Multi-step AI agent for company research.
/// Iterates: LLM → tool call → LLM → ... → final answer.
#[command]
pub async fn run_agent(
    goal: String,
    context: Option<String>,
    task: Option<String>,
    max_iterations: Option<usize>,
    enrichment_urls: Option<Vec<String>>,
) -> Result<AgentResult, String> {
    let task_str = task.unwrap_or_else(|| "company_research".to_string());
    let safe_max = max_iterations.unwrap_or(5).min(10);
    let start = std::time::Instant::now();
    let mut steps: Vec<AgentStep> = Vec::new();
    let mut total_tokens: u64 = 0;

    // Enrich context with fetched URLs
    let mut enriched_context = context.unwrap_or_default();
    if let Some(urls) = enrichment_urls {
        for url in urls {
            if let Ok(text) = fetch_url_content_internal(&url).await {
                enriched_context.push_str(&format!(
                    "\n\n=== KONTEN DARI {} ===\n{}",
                    url, text
                ));
            }
        }
    }

    let system_prompt = get_agent_system_prompt(&task_str);
    let mut messages: Vec<serde_json::Value> = vec![
        serde_json::json!({ "role": "system", "content": system_prompt }),
        serde_json::json!({
            "role": "user",
            "content": format!(
                "GOAL: {}\n\nKONTEKS:\n{}\n\nTools yang tersedia:\n- fetch_url: Fetch dan ekstrak konten teks dari sebuah URL\n- extract_links: Ekstrak semua link dari HTML\n\nMulai sekarang. Gunakan tool jika perlu, atau langsung berikan jawaban final.",
                goal,
                if enriched_context.is_empty() { "(tidak ada konteks tambahan)" } else { &enriched_context }
            )
        }),
    ];

    for i in 0..safe_max {
        // Call LLM
        let ai_resp = call_ai_internal(&messages).await.map_err(|e| {
            format!("Agent error at iteration {}: {}", i, e)
        })?;
        total_tokens += ai_resp.1;

        let content = ai_resp.0;

        // Parse response as JSON
        let cleaned = content
            .replace("```json\n", "")
            .replace("```json", "")
            .replace("```\n", "")
            .replace("```", "")
            .trim()
            .to_string();

        let parsed: serde_json::Value = match serde_json::from_str(&cleaned) {
            Ok(v) => v,
            Err(_) => {
                // Not JSON — treat as final answer
                return Ok(AgentResult {
                    result: content,
                    steps,
                    tokens_used: total_tokens,
                    duration: start.elapsed().as_millis() as u64,
                    success: true,
                });
            }
        };

        let action = parsed["action"].as_str().unwrap_or("final");

        // Final answer
        if action == "final" {
            let result = parsed["result"]
                .as_str()
                .unwrap_or(&content)
                .to_string();
            return Ok(AgentResult {
                result,
                steps,
                tokens_used: total_tokens,
                duration: start.elapsed().as_millis() as u64,
                success: true,
            });
        }

        // Tool call
        if action == "tool" {
            let tool_name = parsed["tool"].as_str().unwrap_or("");
            let tool_args = parsed["arguments"].clone();
            let reasoning = parsed["reasoning"]
                .as_str()
                .unwrap_or("")
                .to_string();

            let tool_output = execute_agent_tool(tool_name, &tool_args).await;

            steps.push(AgentStep {
                iteration: i,
                tool: Some(tool_name.to_string()),
                tool_input: tool_args,
                tool_output: Some(tool_output.chars().take(500).collect()),
                reasoning,
            });

            // Add assistant message and tool result to conversation
            messages.push(serde_json::json!({ "role": "assistant", "content": content }));
            messages.push(serde_json::json!({
                "role": "user",
                "content": format!(
                    "Tool \"{}\" result:\n\n{}\n\nEvaluasi: apakah informasi ini cukup untuk menjawab goal? Kalau belum cukup, ambil langkah berikutnya. Kalau sudah cukup, berikan jawaban final.",
                    tool_name, tool_output
                )
            }));
        }
    }

    // Max iterations reached
    let summary: String = steps
        .iter()
        .enumerate()
        .map(|(idx, s)| {
            format!(
                "**Langkah {}: ** {}",
                idx + 1,
                s.reasoning
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    Ok(AgentResult {
        result: format!(
            "Maksimum iterasi ({}) tercapai. Berikut ringkasan dari {} langkah yang dilakukan:\n\n{}\n\nSilakan lakukan riset manual untuk informasi yang masih kurang.",
            safe_max,
            steps.len(),
            summary
        ),
        steps,
        tokens_used: total_tokens,
        duration: start.elapsed().as_millis() as u64,
        success: false,
    })
}

// ── Internal helpers (not exposed as Tauri commands) ──

/// Internal AI call — returns (content, tokens_used).
async fn call_ai_internal(
    messages: &[serde_json::Value],
) -> Result<(String, u64), String> {
    let key = resolve_ai_key(None).ok_or("AI API key tidak dikonfigurasi")?;
    let base = resolve_ai_base_url(None);
    let model = resolve_ai_model(None);

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 8192,
    });

    let resp = http_client()
        .post(format!("{}/chat/completions", base))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI request error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("AI API error ({}): {}", status, err_text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("AI response parse error: {}", e))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let tokens = data["usage"]["total_tokens"].as_u64().unwrap_or(0);

    Ok((content, tokens))
}

/// Fetch URL content (internal, for agent enrichment).
async fn fetch_url_content_internal(url: &str) -> Result<String, String> {
    let parsed = url::Url::parse(url).map_err(|_| "Invalid URL")?;
    if !["http", "https"].contains(&parsed.scheme()) {
        return Err("Only http/https".to_string());
    }

    let resp = http_client()
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (compatible; uSeeker/2.0)")
        .header("Accept", "text/html,application/xhtml+xml,text/plain")
        .send()
        .await
        .map_err(|e| format!("Fetch error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Fetch failed: {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let raw = resp.text().await.map_err(|e| format!("Read error: {}", e))?;

    Ok(strip_html(&raw, &content_type, 5000))
}

/// Execute an agent tool and return output as string.
async fn execute_agent_tool(name: &str, args: &serde_json::Value) -> String {
    match name {
        "fetch_url" => {
            let url = match args["url"].as_str() {
                Some(u) => u,
                None => return "Error: url is required".to_string(),
            };
            match fetch_url_content_internal(url).await {
                Ok(content) => {
                    let truncated: String = if content.len() > 5000 {
                        content.chars().take(5000).collect::<String>() + "\n...[truncated]"
                    } else {
                        content
                    };
                    truncated
                }
                Err(e) => format!("Gagal mengambil konten dari {}: {}", url, e),
            }
        }
        "extract_links" => {
            let html = match args["html"].as_str() {
                Some(h) => h,
                None => return "Error: html is required".to_string(),
            };
            let filter = args["filter"].as_str();
            let links = extract_links_from_html_filtered(html, filter);
            serde_json::to_string_pretty(&links).unwrap_or_else(|_| "[]".to_string())
        }
        _ => format!("Unknown tool: {}", name),
    }
}

fn get_agent_system_prompt(task: &str) -> String {
    let base = "Kamu adalah AI Agent yang bekerja untuk pencari kerja Indonesia.\n\
        Tugasmu: mencapai goal yang diberikan dengan cara yang paling efektif.\n\n\
        CARA KERJA:\n\
        1. Analisa goal dan tentukan langkah pertama\n\
        2. Kalau butuh informasi dari internet, gunakan tool yang tersedia\n\
        3. Evaluasi hasil — apakah sudah cukup? Kalau belum, ambil langkah berikutnya\n\
        4. Ulangi sampai goal tercapai atau maksimum iterasi\n\n\
        OUTPUT FORMAT:\n\
        Kamu HARUS respond dalam format JSON yang valid. Pilih SATU dari dua format:\n\n\
        Format 1 — Gunakan tool:\n\
        {\n  \"action\": \"tool\",\n  \"tool\": \"nama_tool\",\n  \"arguments\": { \"param\": \"value\" },\n  \"reasoning\": \"Mengapa saya menggunakan tool ini\"\n}\n\n\
        Format 2 — Selesai (final answer):\n\
        {\n  \"action\": \"final\",\n  \"result\": \"Jawaban final yang lengkap dan terstruktur\"\n}\n\n\
        ATURAN PENTING:\n\
        - Jangan mengarang informasi. Gunakan tool untuk mendapatkan data nyata.\n\
        - Kalau tool gagal, coba URL alternatif atau methods lain.\n\
        - Batasi diri ke MAXIMUM 10 iterasi.\n\
        - Setiap fetch harus punya tujuan jelas.\n\
        - Output final HARUS dalam Bahasa Indonesia.";

    if task == "company_research" {
        format!(
            "{}\n\n\
            SPESIFIK UNTUK RISET PERUSAHAAN:\n\
            Goal: Analisis mendalam tentang perusahaan untuk membantu pencari kerja.\n\n\
            Informasi yang perlu dikumpulkan:\n\
            1. Sejarah & profil perusahaan\n\
            2. Produk/layanan utama\n\
            3. Industri & posisi pasar\n\
            4. Budaya kerja\n\
            5. Red flags (jika ada)\n\
            6. Tips wawancara\n\n\
            Strategi:\n\
            - Fetch website resmi perusahaan\n\
            - Cari artikel berita terkait\n\
            - Ekstrak informasi dari setiap sumber\n\
            - Sintesis semua data ke laporan komprehensif",
            base
        )
    } else {
        base.to_string()
    }
}

// ── Search providers ──

async fn search_duckduckgo(query: &str) -> Option<Vec<SearchResult>> {
    let params = [("q", query), ("kl", "wt-wt")];
    let resp = http_client()
        .post("https://lite.duckduckgo.com/lite/")
        .form(&params)
        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let html = resp.text().await.ok()?;
    if html.contains("Internet Positif") {
        return None;
    }

    let mut results = Vec::new();
    let link_re = Regex::new(
        r#"<a[^>]+href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)</a>"#,
    )
    .ok()?;
    let snippet_re = Regex::new(
        r#"<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)</td>"#,
    )
    .ok()?;

    for caps in link_re.captures_iter(&html) {
        if results.len() >= 5 {
            break;
        }
        let mut url = caps.get(1)?.as_str().to_string();
        let title = strip_tags(caps.get(2)?.as_str()).trim().to_string();

        // Extract real URL from DDG redirect
        if let Some(uddg) = url.find("uddg=") {
            let encoded = &url[uddg + 5..];
            let end = encoded.find('&').unwrap_or(encoded.len());
            if let Ok(decoded) = urlencoding::decode(&encoded[..end]) {
                url = decoded;
            }
        }

        if url.is_empty() || title.is_empty() || url.starts_with("//") {
            continue;
        }

        // Extract snippet
        let link_pos = caps.get(0)?.start();
        let snippet_area = &html[link_pos..std::cmp::min(link_pos + 500, html.len())];
        let content = snippet_re
            .captures(snippet_area)
            .map(|c| strip_tags(c.get(1).unwrap().as_str()).trim().to_string())
            .unwrap_or_default();

        results.push(SearchResult {
            title,
            url,
            content,
        });
    }

    if results.is_empty() {
        None
    } else {
        Some(results)
    }
}

async fn search_brave(query: &str) -> Option<Vec<SearchResult>> {
    let key = resolve_brave_key()?;
    let url = format!(
        "https://api.search.brave.com/res/v1/web/search?q={}&count=5",
        urlencoding::encode(query)
    );

    let resp = http_client()
        .get(&url)
        .header("Accept", "application/json")
        .header("Accept-Encoding", "gzip")
        .header("X-Subscription-Token", &key)
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let data: serde_json::Value = resp.json().await.ok()?;
    let web_results = data["web"]["results"].as_array()?;

    Some(
        web_results
            .iter()
            .take(5)
            .filter_map(|r| {
                Some(SearchResult {
                    title: r["title"].as_str().unwrap_or("").to_string(),
                    url: r["url"].as_str().unwrap_or("").to_string(),
                    content: r["description"].as_str().unwrap_or("").to_string(),
                })
            })
            .collect(),
    )
}

async fn search_bing(query: &str) -> Option<Vec<SearchResult>> {
    let key = resolve_bing_key()?;
    let url = format!(
        "https://api.bing.microsoft.com/v7.0/search?q={}&count=5",
        urlencoding::encode(query)
    );

    let resp = http_client()
        .get(&url)
        .header("Ocp-Apim-Subscription-Key", &key)
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let data: serde_json::Value = resp.json().await.ok()?;
    let web_pages = data["webPages"]["value"].as_array()?;

    Some(
        web_pages
            .iter()
            .take(5)
            .filter_map(|r| {
                Some(SearchResult {
                    title: r["name"].as_str().unwrap_or("").to_string(),
                    url: r["url"].as_str().unwrap_or("").to_string(),
                    content: r["snippet"].as_str().unwrap_or("").to_string(),
                })
            })
            .collect(),
    )
}

// ── HTML helpers ──

/// Strip HTML tags, scripts, styles → clean plain text.
fn strip_html(raw: &str, content_type: &str, max_chars: usize) -> String {
    if !content_type.contains("text/html") {
        let trimmed = raw.trim();
        return if trimmed.len() > max_chars {
            format!("{}...[truncated]", &trimmed[..max_chars])
        } else {
            trimmed.to_string()
        };
    }

    let script_re = Regex::new(r"(?is)<script[\s\S]*?</script>").unwrap();
    let style_re = Regex::new(r"(?is)<style[\s\S]*?</style>").unwrap();
    let nav_re = Regex::new(r"(?is)<nav[\s\S]*?</nav>").unwrap();
    let footer_re = Regex::new(r"(?is)<footer[\s\S]*?</footer>").unwrap();
    let header_re = Regex::new(r"(?is)<header[\s\S]*?</header>").unwrap();
    let tag_re = Regex::new(r"(?s)<[^>]+>").unwrap();
    let ws_re = Regex::new(r"\s+").unwrap();

    let text = script_re.replace_all(raw, "");
    let text = style_re.replace_all(&text, "");
    let text = nav_re.replace_all(&text, "");
    let text = footer_re.replace_all(&text, "");
    let text = header_re.replace_all(&text, "");
    let text = tag_re.replace_all(&text, " ");
    let text = text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">");
    let text = ws_re.replace_all(&text, " ").trim().to_string();

    if text.len() > max_chars {
        format!("{}...[truncated]", &text[..max_chars])
    } else {
        text
    }
}

/// Strip HTML tags from a string (no truncation).
fn strip_tags(s: &str) -> String {
    let tag_re = Regex::new(r"(?s)<[^>]+>").unwrap();
    tag_re.replace_all(s, "").to_string()
}

/// Extract links from HTML, resolving relative URLs.
fn extract_links_from_html(html: &str, _base_url: &str) -> Vec<LinkItem> {
    extract_links_from_html_filtered(html, None)
}

fn extract_links_from_html_filtered(
    html: &str,
    filter: Option<&str>,
) -> Vec<LinkItem> {
    let link_re =
        Regex::new(r#"(?i)<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</a>"#).unwrap();
    let mut seen = std::collections::HashSet::new();
    let mut links = Vec::new();

    for caps in link_re.captures_iter(html) {
        if links.len() >= 20 {
            break;
        }
        let href = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let text = caps.get(2).map(|m| m.as_str().trim()).unwrap_or("");

        if href.is_empty() || href.starts_with('#') || href.starts_with("javascript:") {
            continue;
        }

        // Filter
        if let Some(f) = filter {
            let f_lower = f.to_lowercase();
            if !href.to_lowercase().contains(&f_lower)
                && !text.to_lowercase().contains(&f_lower)
            {
                continue;
            }
        }

        if seen.contains(href) {
            continue;
        }
        seen.insert(href.to_string());

        links.push(LinkItem {
            url: href.to_string(),
            text: if text.is_empty() {
                href.to_string()
            } else {
                text.to_string()
            },
        });
    }

    links
}


fn chrono_now() -> String {
    // Simple timestamp without chrono dependency
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| format!("{}.{:03}", d.as_secs(), d.subsec_millis()))
        .unwrap_or_else(|_| "unknown".to_string())
}

// Need urlencoding crate for DDG and search URL encoding
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::with_capacity(s.len() * 3);
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                b' ' => encoded.push('+'),
                _ => {
                    encoded.push('%');
                    encoded.push_str(&format!("{:02X}", byte));
                }
            }
        }
        encoded
    }

    pub fn decode(s: &str) -> Result<String, std::string::FromUtf8Error> {
        let mut decoded = Vec::with_capacity(s.len());
        let mut chars = s.bytes();
        while let Some(b) = chars.next() {
            match b {
                b'+' => decoded.push(b' '),
                b'%' => {
                    let hex: String = chars.by_ref().take(2).map(|c| c as char).collect();
                    if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                        decoded.push(byte);
                    }
                }
                _ => decoded.push(b),
            }
        }
        String::from_utf8(decoded)
    }
}
