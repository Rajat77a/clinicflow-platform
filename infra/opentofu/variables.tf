variable "environment" {
  description = "Dedicated ClinicFlow installation environment."
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "app_url" {
  description = "Canonical HTTPS URL for this hospital installation."
  type        = string

  validation {
    condition     = var.environment != "production" || startswith(var.app_url, "https://")
    error_message = "Production app_url must use HTTPS."
  }
}

variable "supabase_url" {
  description = "Dedicated Supabase project URL. This value is public."
  type        = string

  validation {
    condition     = can(regex("^https://[a-z0-9]+\\.supabase\\.co$", var.supabase_url))
    error_message = "supabase_url must be a valid hosted Supabase project URL."
  }
}

variable "demo_mode" {
  description = "Whether synthetic demo workflows are enabled."
  type        = bool
  default     = false

  validation {
    condition     = var.environment != "production" || !var.demo_mode
    error_message = "Demo mode must be disabled in production."
  }
}
