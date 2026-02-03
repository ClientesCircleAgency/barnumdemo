# Documentation Structure

This directory contains all project documentation organized by purpose and lifecycle stage.

## Structure Overview

```
docs/
├── README.md           # This file - documentation structure guide
├── contracts/          # Active contracts for frontend-backend alignment
├── context/            # Audits, analysis, and historical reasoning
└── archive/            # Archived, exploratory, and future-phase material
    └── n8n/           # n8n integration guides (not finalized)
```

## Directory Purposes

### contracts/
**Purpose**: Active source of truth for frontend-backend alignment

Contains the definitive contracts that define interfaces between:
- Frontend and database (`FRONTEND_DB_CONTRACT.md`)
- Frontend type system (`FRONTEND_ENUMS_AND_TYPES.md`)
- Vercel API routes (`VERCEL_API_CONTRACT.md`)
- Backend schema snapshot (`supabase_backend_snapshot.md`)

**These are the ONLY files to use for development during the alignment phase.**

### context/
**Purpose**: Historical audits, analysis, and technical reasoning

Contains documentation that explains:
- Why decisions were made
- How the project evolved
- Technical audits and analysis
- Setup guides and procedures

These files provide important context but are NOT active contracts.

### archive/
**Purpose**: Archived material not currently in use

Contains:
- Exploratory documentation
- Duplicate files superseded by newer versions
- Future-phase material (e.g., n8n guides)

**archive/n8n/** specifically contains WhatsApp and n8n integration guides that are NOT finalized and represent future-phase work.

## Current Phase

**Frontend-Backend Alignment Phase**

During this phase:
- ✅ Use `contracts/` as the sole source of truth
- ℹ️ Reference `context/` for understanding and reasoning
- ⛔ Ignore `archive/` (future work)

---

Last updated: 2026-01-30
