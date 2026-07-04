-- M7: Performance: partial index on space_invites.status for accept_invite().
-- The accept_invite() RPC filters on status='pending' after matching by unique
-- token (so the benefit is marginal), but a partial index keeps only live
-- invites in the index, making it cheap as the table accumulates history.
create index if not exists space_invites_status_idx
  on public.space_invites (status)
  where status = 'pending';
