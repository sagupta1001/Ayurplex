-- Migration 0001: enable required Postgres extensions.
--
-- Plan 1 ships an intentionally empty schema — just the extensions every
-- subsequent migration will rely on. Real tables (users, medications,
-- schedules, doses, prescriptions, calendar cache, RLS policies) land in
-- later plans.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
