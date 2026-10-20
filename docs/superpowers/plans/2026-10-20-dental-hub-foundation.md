# Dental Hub Foundation Implementation Plan

> **For agentic workers:** Use `executing-plans` for native execution or `subagent-driven-development` if the user selects delegation. Execute and verify one task at a time.

**Goal:** Install and verify the organizational access foundation in the empty DentalHub database, independently from Barnun.

**Architecture:** Shared PostgreSQL tables with organization-scoped composite references and RLS. Auth supplies identity; live memberships and location assignments supply authorization. Restricted management RPCs enforce role and ownership rules.

**Tech Stack:** Supabase PostgreSQL 17, SQL migrations, pgTAP or SQL assertions in rollback transactions, PowerShell runner, Supabase CLI pinned to 2.121.0.

**Spec:** `../specs/2026-10-20-dental-hub-phase-one.md`

## Global Constraints

- Target only `ihkjadztuopcvvmmodpp`; never link or apply these migrations to Barnun `oziejxqmghwmtjufstfp`.
- New independent repository: `Projects/dental-hub`. Do not copy `.env`, `.vercel`, Supabase temp state or credentials from Barnun.
- No patient migration, domain cutover, billing, n8n modification or external notifications.
- Roles: `owner`, `admin`, `secretary`, `doctor`; membership states: `active`, `revoked`.
- Commercial plans, prices and quotas remain undecided. No fixed numeric plan limits in the schema.
- No clinical data access is implied by organization management.
- Test fixtures must roll back; never commit credentials or test identities to the remote database.

## Review Focus

1. Concurrent last-owner revocation: serialize per organization and retain an active owner (task 3).
2. Archived parent with active child: deny operational access through any ancestor (task 2).
3. Identity with different roles in two groups: no privilege leakage (task 2).
4. Changing identifiers through UPDATE: prevent moving records between tenants (tasks 1–2).
5. Replaying assignment after revocation: deny new operations without needing a new JWT (tasks 2–3).

## Files and execution conventions

All paths below are relative to `Projects/dental-hub`.

- `supabase/config.toml`: independent project configuration.
- `supabase/migrations/<CLI timestamp>_foundation.sql`: six foundation tables, constraints, RLS, grants and management functions; generate filename with `supabase migration new foundation`.
- `supabase/tests/foundation.sql`: fixtures, assertions, rollback.
- `scripts/verify-foundation.ps1`: checks exact project ref, executes tests, fails on nonzero CLI exit.
- `docs/operations/foundation-verification.md`: actual results and remaining scope.
- `.gitignore`: environments, credentials, CLI temp files and generated local state.
- `README.md`: target project, migration/test commands, no production clinical readiness claim.

Use local Supabase if Docker is available. Otherwise rehearse the SQL plus assertions within one remote transaction ending in ROLLBACK on the empty DentalHub target; only apply the durable migration after rehearsal passes. Do not fall back to Barnun. Inspect CLI help before choosing commands.

### Task 1: Tenant hierarchy and referential integrity

**Files:** migration, tests, config, gitignore, README and verification runner above.

**Interfaces:** `organizations(id,name,slug,status,created_at)`, `legal_entities(id,organization_id,name,country_code,tax_id,status,created_at)`, `locations(id,organization_id,legal_entity_id,name,phone,email,address,timezone,branding,status,created_at)`, `user_profiles(user_id,full_name,preferences)`, `organization_memberships(id,organization_id,user_id,role,status,created_at)`, `membership_locations(organization_id,membership_id,location_id)`.

- [ ] Initialize separate Git repository/config without installing frontend dependencies; copy the approved spec and plan into its docs.
- [ ] Write assertions for six tables, UUID primary keys, required tenant IDs, unique organization slug, unique membership per organization/user, unique assignment and fiscal identity per organization/country; run and observe missing-object failure.
- [ ] Generate the migration filename through CLI. Implement tables with nonempty names, allowed roles/states, composite unique keys and composite foreign keys. Use RESTRICT for business relationships. Users retain identity across memberships; membership revocation is not deletion.
- [ ] Test cross-organization entity/unit and membership/unit references: SQLSTATE 23503. Test duplicate memberships: 23505. Assert identity/tenant keys cannot be changed through ordinary authenticated writes.
- [ ] Run rehearsal and verify all assertions pass; commit task files.

### Task 2: Read isolation and minimal grants

**Files:** same migration and tests.

**Interfaces:** private authorization functions `private.is_org_manager(uuid) returns boolean`, `private.can_access_location(uuid,uuid) returns boolean`, `private.is_org_member(uuid) returns boolean`. Each resolves current `auth.uid()` and active ancestors/membership; takes no caller-supplied user ID.

- [ ] Add fixtures for two groups, multiple entities/units, owner/admin/secretary/doctor and one identity with different roles across groups. Assert anon sees no organization data; nonmember sees none; a secretary sees assigned locations only; owner/admin see all active locations of their group.
- [ ] Observe failures before adding policies. Implement RLS on all six tables and minimal SELECT/column UPDATE grants. Self profile editing excludes identity keys and roles. Membership visibility: self or own-group manager. Legal entity visibility: manager or at least one accessible child location. No anonymous organizational reads.
- [ ] Implement private helpers with fixed search_path, qualified names, restricted EXECUTE, no public-schema definer helpers and no RLS recursion. Deny authenticated direct membership/assignment writes.
- [ ] Test archived organization, archived entity, archived location, revoked membership and removed assignment. Verify a user who is admin in group A and doctor in B cannot manage B.
- [ ] Rehearse with `SET LOCAL ROLE authenticated` and `request.jwt.claims` identities; failures raise exceptions and fail the runner. Commit after passing.

### Task 3: Controlled management operations

**Files:** migration and tests.

**Interfaces:** authenticated RPCs `set_member_access(p_organization_id uuid,p_membership_id uuid,p_role text,p_status text) returns void` and `set_member_location(p_organization_id uuid,p_membership_id uuid,p_location_id uuid,p_assigned boolean) returns void`. `private.provision_organization(p_owner_user_id uuid,p_name text,p_slug text) returns uuid` is restricted to service role, creating organization/owner atomically.

- [ ] Write assertions rejecting nonmanager calls, another group's target, self-promotion by a nonmanager, admin changes to owners, and last-owner demotion/revocation.
- [ ] Implement authenticated identity checks, live membership checks, row locks on the organization before ownership changes, validation of target role/status and tenant references. Owner may manage ownership while preserving at least one owner; admin may manage nonowners only. Assignment cannot reactivate a revoked membership.
- [ ] Limit EXECUTE to the required roles; default PUBLIC execution revoked. Ordinary users cannot invoke provision_organization. Test provisioning rollback on invalid owner and duplicate slug.
- [ ] Test valid changes, revocation with unchanged JWT claims, and two-session simultaneous owner revocation in a disposable test environment: at least one owner remains. If no two-session environment is available, record the concurrency test as unverified and do not claim it passed.
- [ ] Test restricted organization/entity/location configuration writes with immutable tenant keys. If writes need RPCs to preserve immutability, add explicit scoped update RPCs rather than broad UPDATE grants.
- [ ] Run complete rehearsal; commit after passing.

### Task 4: Apply and certify foundation scope

**Files:** verification runner and verification report; generated types only if needed by the next application task.

- [ ] Verify target project name/ref and empty baseline. Inspect migration for unintended schema drops, outbound calls, anonymous grants and service secrets.
- [ ] Run complete rollback rehearsal, including failure paths, against the exact DentalHub project; record actual counts and outcomes.
- [ ] Link only the new project directory, dry-run migration push, inspect pending migration list, apply the reviewed migration.
- [ ] Run assertions again on installed schema, verify RLS/grants and ensure fixtures left zero Auth users/organizations. Run database advisors and investigate relevant findings.
- [ ] Record migration version, test results, unverified checks and limitations; commit. No push to Barnun and no changes to its deployment.

## Self-review and handoff

The six-table foundation, hierarchy, membership isolation, management permissions and verification are covered by tasks 1–4. Clinical operations, onboarding UI, invites, brand extraction, plans and billing remain separate deliveries as specified. No claim is made about API/Storage/Realtime clinical flows that do not yet exist.

Recommended execution: native in this session, sequentially, because all tasks refine the same migration and shared authorization invariants. A final independent review should inspect tenant isolation and privileged functions before treating the foundation as ready for application use.
