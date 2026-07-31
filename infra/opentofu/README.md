# Portable Deployment Contract

This OpenTofu module validates ClinicFlow's non-secret runtime contract without
binding the application to Vercel, Supabase, or a paid infrastructure provider.
It deliberately does not provision resources or store credentials.

```sh
tofu init
tofu plan -var-file=production.tfvars
```

Copy `production.tfvars.example` to an ignored `production.tfvars` and replace
the example values. Keep publishable and secret keys in the selected host's
secret manager. A provider-specific module should be added only after a hospital
selects its approved infrastructure and data residency region.
