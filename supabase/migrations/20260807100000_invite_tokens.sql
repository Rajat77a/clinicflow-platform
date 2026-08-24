-- Unlimited-validity invite tokens for password setup links.
-- Tokens never expire until the invited user sets their password.

begin;

create table if not exists public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  phone text not null default '',
  role_code text not null,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  facility_id uuid,
  department_id uuid,
  token text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  clinic_name text,
  clinic_email text,
  clinic_phone text,
  clinic_address text,
  specialty text,
  shift text,
  gender text,
  qualification text,
  medical_registration_number text,
  experience_years integer,
  consultation_fee numeric,
  working_hours text,
  administrative_notes text
);

comment on table public.invite_tokens is 'Stores unlimited-validity invite tokens for staff password setup.';

create index if not exists idx_invite_tokens_email on public.invite_tokens (email);
create index if not exists idx_invite_tokens_token on public.invite_tokens (token) where used_at is null;

alter table public.invite_tokens enable row level security;

-- Only service_role can read/write invite tokens (edge functions use service key)
create policy "Service role manages invite tokens"
  on public.invite_tokens
  for all
  using (true)
  with check (true);

-- Generate a cryptographically random token
create or replace function private.generate_invite_token()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(32), 'hex')
$$;

-- Mark a token as used and return all invite data
create or replace function public.consume_invite_token(p_token text)
returns table (
  p_email text,
  p_full_name text,
  p_phone text,
  p_role_code text,
  p_hospital_id uuid,
  p_facility_id uuid,
  p_department_id uuid,
  p_clinic_name text,
  p_clinic_email text,
  p_clinic_phone text,
  p_clinic_address text,
  p_specialty text,
  p_shift text,
  p_gender text,
  p_qualification text,
  p_medical_registration_number text,
  p_experience_years integer,
  p_consultation_fee numeric,
  p_working_hours text,
  p_administrative_notes text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.invite_tokens
  set used_at = now()
  where token = p_token
    and used_at is null
  returning
    email, full_name, phone, role_code, hospital_id, facility_id, department_id,
    clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes;
end;
$$;

commit;
