# Security tests

`security_isolation_rpc025.sql` — run in the Supabase SQL editor. Creates throwaway users/orgs inside one
transaction and always ends with `RAISE EXCEPTION 'TESTOUT passes=N fails=M ...'` so nothing is stored.
Read the report from the error message; any line starting with `FAIL` is a defect.

Covers: tenant isolation on 14 tables, ~23 RPCs called by a foreign organization, direct DML and cross-org moves,
anon access, service-only functions, dealer-role restrictions, and functional checks of migration 025.

Last run 2026-11-20: 105 passed, 0 failed (after migration 026).
