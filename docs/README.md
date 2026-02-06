# Barnum — Documentation

> **Last updated:** 2026-02-06

---

## Structure

```
docs/
├── context/                  # Project state & AI agent context
│   ├── PROJECT_CANONICAL_CONTEXT.md   ← Single source of truth
│   ├── AGENT_CONTEXT.md               ← Auto-updated for AI agents (Cursor)
│   └── GLOSSARY.md                    ← Technical terms glossary
│
├── contracts/                # Technical specifications & contracts
│   ├── N8N_PARTNER_COMPLETE_GUIDE.md  ← Complete guide for n8n partner ⭐
│   ├── WHATSAPP_AUTOMATIONS_SPEC.md   ← WhatsApp automations specification
│   ├── DATABASE_SCHEMA.md             ← Full database schema reference
│   └── FRONTEND_DB_CONTRACT.md        ← Frontend ↔ DB query contract
│
├── operations/               # Deployment, QA, development guides
│   ├── PRODUCTION_MIGRATION_PLAN.md   ← Migration order for production
│   ├── LOCAL_DEV_RUNBOOK.md           ← How to run locally
│   └── QA_CHECKLIST.md               ← Manual testing checklist
│
└── README.md                 ← This file
```

---

## Reading Order

### For a new developer
1. `context/PROJECT_CANONICAL_CONTEXT.md` — Understand the project
2. `operations/LOCAL_DEV_RUNBOOK.md` — Get it running
3. `contracts/DATABASE_SCHEMA.md` — Understand the data model
4. `operations/QA_CHECKLIST.md` — Know what to test

### For the n8n partner
1. `contracts/N8N_PARTNER_COMPLETE_GUIDE.md` — **Start and end here** (complete guide)
2. `contracts/WHATSAPP_AUTOMATIONS_SPEC.md` — Deep dive on each automation if needed

### For AI agents (Cursor/ChatGPT)
1. `context/AGENT_CONTEXT.md` — Quick reference (always up to date)
2. `context/PROJECT_CANONICAL_CONTEXT.md` — Full detail when needed

---

## Trust Hierarchy

1. **Code + Migrations** — Always the truth
2. **context/PROJECT_CANONICAL_CONTEXT.md** — Verified against code
3. **contracts/** — Technical specs, may lag slightly behind code
4. **operations/** — Guides, updated as needed

If docs conflict with code, **code wins**.

---

## Also in the repo root

- `ChatGPT_5.2_context.md` — Context file to paste into ChatGPT conversations
- `README.md` — Project overview and quick start
