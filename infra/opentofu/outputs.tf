output "runtime_environment" {
  description = "Non-secret runtime contract for the selected host."
  value = {
    VITE_CLINICFLOW_APP_URL   = var.app_url
    VITE_CLINICFLOW_DEMO_MODE = tostring(var.demo_mode)
    VITE_SUPABASE_URL          = var.supabase_url
  }
}
