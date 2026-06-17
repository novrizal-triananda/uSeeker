fn main() {
    // Forward env vars so option_env!() can read them at compile time.
    // These are set from GitHub Secrets during CI builds.
    println!("cargo:rerun-if-env-changed=USEEKER_AI_API_KEY");
    println!("cargo:rerun-if-env-changed=USEEKER_AI_BASE_URL");
    println!("cargo:rerun-if-env-changed=USEEKER_AI_MODEL");
    println!("cargo:rerun-if-env-changed=USEEKER_BRAVE_API_KEY");
    println!("cargo:rerun-if-env-changed=USEEKER_BING_API_KEY");

    tauri_build::build()
}
