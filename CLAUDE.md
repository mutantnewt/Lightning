# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains **Literary Light** (`literary-light/`), a web application for discovering and exploring classic literature in the public domain, alongside development documentation for the **Lightning Classics** publishing pipeline project.

### Literary Light Application

A React-based catalog application that allows users to search, browse, and discover classic literature works that are in the public domain. Built with modern web technologies for a clean, elegant reading-focused experience.

**Tech Stack:**
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS with custom theme (navy, parchment, gold palette for classic literary aesthetic)
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Routing:** React Router v6
- **State Management:** TanStack Query, React hooks
- **Typography:** Playfair Display (serif) for headings, Inter (sans-serif) for body

### Lightning Classics Pipeline (Documentation)

An AWS-based automated publishing pipeline (documented in `LIGHTNING_CLASSICS_DEV_BACKLOG.md`) designed to convert public domain texts into multi-format "Reader's Edition" books across EPUB, Kindle, Print PDF, Large-Print, Audiobook, and Braille formats.

## Development Commands

### Literary Light Application

Navigate to `literary-light/` directory first:

```bash
cd literary-light
```

**Install dependencies:**
```bash
npm install
```

**Run development server:**
```bash
npm run dev
```
Server runs on `http://[::]:8080` (IPv6 localhost, port 8080)

**Build for production:**
```bash
npm run build
```

**Build for development (with dev mode optimizations):**
```bash
npm run build:dev
```

**Lint code:**
```bash
npm run lint
```

**Preview production build:**
```bash
npm run preview
```

## Code Architecture

### Application Structure

```
literary-light/
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui base components (accordion, button, card, etc.)
│   │   ├── BookCard.tsx   # Book display card component
│   │   ├── Layout.tsx     # Main layout wrapper with nav
│   │   ├── SearchBar.tsx  # Search input component
│   │   └── Pagination.tsx # Pagination controls
│   ├── pages/             # Route page components
│   │   ├── Index.tsx      # Home page with book browsing
│   │   ├── AddBook.tsx    # Book addition form
│   │   ├── FAQ.tsx        # FAQ page
│   │   └── NotFound.tsx   # 404 page
│   ├── data/              # Static data
│   │   ├── books.ts       # Seed book data (12 classic works)
│   │   └── faq.ts         # FAQ entries
│   ├── lib/               # Utility functions
│   │   ├── search.ts      # Book search and pagination logic
│   │   └── utils.ts       # General utilities (cn for className merging)
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Book and FaqEntry types
│   ├── hooks/             # Custom React hooks
│   └── App.tsx            # Root component with routing
├── public/                # Static assets
└── index.html            # Entry HTML
```

### Key Architectural Patterns

**Component Organization:**
- `ui/` contains primitive components from shadcn/ui that are copied into the project (not imported from npm)
- Custom components in `components/` compose these primitives
- Page components in `pages/` handle routing and page-level state

**Data Flow:**
- Static book data in `src/data/books.ts` serves as the data source
- Search functionality implemented client-side with keyword matching (see `lib/search.ts`)
- Pagination computed client-side (10 results per page)
- No backend API currently - all data is static

**Routing:**
- `/` - Home page with book browsing and search
- `/add-book` - Form to suggest new books (query params support pre-filling title)
- `/faq` - Frequently asked questions
- `*` - 404 Not Found page

**Search Implementation:**
- Multi-keyword search splits query by whitespace
- Searches across: title, author, year, era, country, category, workType, summary, authorBio, tags, source
- All keywords must match (AND logic) for a result to appear
- Case-insensitive matching

**Type System:**
- `Book` type in `src/types/index.ts` defines the core data model
- Fields include: id, title, author, year, era, country, category, workType, summary, authorBio, tags, source, publicDomain status
- Optional fields use `| null` pattern
- `WorkType` is a union type: "Novel" | "Play" | "Poem" | "Essay" | "Collection" | "Short Story" | "Other"

**Styling Approach:**
- Tailwind utility classes for layout and styling
- Custom color palette via CSS variables in Tailwind config:
  - `navy` - Deep blue for headers/accents
  - `parchment` - Warm cream for backgrounds
  - `gold` - Accent color
  - `bronze` - Secondary accent
- Responsive design with mobile-first approach
- Custom animations: `fade-in`, `slide-in` for smooth transitions

### Configuration Files

**TypeScript Configuration:**
- Path alias `@/*` maps to `./src/*` for clean imports
- Relaxed strictness settings: `noImplicitAny: false`, `strictNullChecks: false`
- References to `tsconfig.app.json` and `tsconfig.node.json` for project/build separation

**Vite Configuration:**
- Dev server on IPv6 `::` host, port 8080
- SWC plugin for fast React compilation
- `lovable-tagger` plugin in development mode (for Lovable.dev integration)
- Path alias configured to match TypeScript

**Tailwind:**
- Extended with custom fonts, colors, and animations
- Dark mode support via class strategy
- `@tailwindcss/typography` plugin available (dev dependency)

## Important Notes

**Lovable Integration:**
- This project was originally created with Lovable.dev (see `README.md`)
- Includes `lovable-tagger` dev dependency for component tagging
- Changes can be made via Lovable or local IDE and will sync

**Data Source:**
- Books link to Project Gutenberg as source
- All included works are public domain
- Currently 12 seed books covering various eras and genres

**No Backend:**
- This is a static frontend-only application
- No database, no API calls, no authentication
- All data in `src/data/` files

**Component Library:**
- shadcn/ui components are copied into `src/components/ui/` (not installed via npm)
- To add new shadcn/ui components, use their CLI or copy manually
- Components are customized via Tailwind classes and can be modified directly

## Lightning Classics Pipeline (Context)

The `LIGHTNING_CLASSICS_DEV_BACKLOG.md` file documents an AWS CDK-based automated book production pipeline. While not currently implemented in this repository, it provides context for the future direction of transforming this catalog into a full publishing platform.

**Pipeline Architecture (Planned):**
- AWS Step Functions state machine orchestrating the entire book production process
- Lambda functions for each processing step (text cleaning, OCR, metadata generation, etc.)
- S3 buckets for work artifacts and final releases
- DynamoDB for book/edition/job metadata
- Bedrock AI for cover art and marketing copy generation
- Multi-format output: EPUB, Kindle, Print PDF, Large-Print PDF, Audiobook (Polly), Braille

**Key Pipeline Phases:**
1. Source acquisition from allowed domains (Gutenberg, Internet Archive)
2. Text normalization and structure extraction
3. Metadata and ISBN generation
4. Cover design and interior artwork
5. Multi-format typesetting
6. Quality gates (accessibility, malware scanning, metadata consistency)
7. Release packaging and distribution

This provides context for why the application focuses on public domain works and includes fields like `source`, `publicDomain`, and detailed metadata.
