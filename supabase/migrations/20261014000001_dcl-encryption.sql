-- =============================================================================
-- DCL — grants for the encryption helpers and decrypted views.
-- authenticated may only decrypt and normalize (needed by the
-- security_invoker views); it can never read Vault, encrypt or hash directly.
-- =============================================================================

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.decrypt_text(text)     to authenticated;
grant execute on function private.normalize_search(text) to authenticated;

grant select on public.client_decrypted, public.vehicle_decrypted,
                public.appointment_decrypted, public.job_decrypted
  to authenticated;
revoke all on public.client_decrypted, public.vehicle_decrypted,
              public.appointment_decrypted, public.job_decrypted
  from anon;
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.client_decrypted, public.vehicle_decrypted,
     public.appointment_decrypted, public.job_decrypted
  from authenticated;
