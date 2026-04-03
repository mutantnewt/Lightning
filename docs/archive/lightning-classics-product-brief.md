# Lightning Classics – Product Brief & Requirements Document

## 01. Target User

Be specific – think **“curious readers exploring classic literature online”** rather than just “readers”. Lightning Classics primarily serves:

- **Independent learners and lifelong readers** who want to discover and read classic literature that is in the public domain.  
- **Students and educators** who need a reliable, uncluttered place to look up canonical works, summaries, and author details.  
- **Curators / librarians / organisers of reading groups** who want a simple way to grow a shared catalogue of classics without needing technical skills.

These users are comfortable with the web, but not necessarily with technical tools. They expect clarity, trustworthiness, and minimal friction in finding books and understanding whether they are free to read.

---

## 02. Problem Statement

Readers who want to explore classic literature face several recurring frustrations in their daily workflow:

- **Scattered and inconsistent information**: Public-domain works are spread across multiple sites, with varying quality of metadata, summaries, and author details.  
- **Unclear copyright status**: It is often unclear whether a work is genuinely out of copyright and safe to use.  
- **Poor discovery experience**: Many catalogues are built for librarians or power users, not for casual exploration and learning. Search is either too strict or too vague, and browsing by era/theme is difficult.  
- **Hard to “grow” a catalogue together**: When someone discovers a missing classic, there’s no simple, guided way to propose it and have that data stored consistently.

These gaps make it harder for readers, teachers, and group organisers to confidently explore, reference, and share classic works.

---

## 03. Solution Design (Core Concept)

**Lightning Classics** is a focused web app that offers:

> **A curated, searchable library of public-domain classic literature, plus a simple way to add missing works using AI-assisted metadata and copyright checks.**

The core feature that addresses the main problem is:

- A **search-first interface** that allows users to find books by any known information (title, author, year, era, tags, etc.), see consistent details, and quickly view short author bios and summaries.  
- An **“Add Book” flow** that connects to ChatGPT to look up a candidate work, check whether it is out of copyright, and (if eligible) propose a structured, ready-to-add record into the Lightning Classics library — all without the user needing to research or format the data themselves.

This combination of **high-quality discovery** and **guided catalogue growth** removes friction for users while keeping the library consistent and trustworthy.

---

## 04. Success Metric

We will know Lightning Classics is working when:

- **Discovery metrics**
  - Users successfully find at least one relevant book in a typical search (e.g. ≥ 70% of searches result in at least one click to a book detail view).  
  - Returning visitors: a meaningful portion of users come back (e.g. ≥ 25% of users return within 30 days).

- **Growth metrics**
  - Users use the “Add Book” flow to propose new books, and a growing share of the library originates from user contributions (e.g. > 20% of entries over time).  
  - Newly added books are consistently complete (title, author, year, summary, author bio, tags) with minimal manual correction.

- **Experience metrics**
  - Users rate the app as easy to use and trustworthy in qualitative feedback (e.g. ≥ 4/5 average satisfaction in simple in-app surveys).  
  - Support/FAQ usage indicates that key questions are answered without direct human support.

A clear brief now should act as a **north star** for design and development. Ambiguity at this stage leads to rework later; this document aims to minimise that by specifying the product behaviour in detail.

---

# Product Overview

Lightning Classics is a **web-based classic literature discovery app** with three main user experiences:

1. **Search** – Search and browse the existing library of classic works.  
2. **Add Book** – Propose a new book to be added; ChatGPT assists by fetching metadata, checking copyright status, and generating summary/author details.  
3. **FAQ** – A simple, interactive FAQ page where clicking a question reveals its answer.

The app will be **technology-agnostic at this stage**. The requirements describe behaviour and data, not specific implementation technologies.

---

# User Experience & Navigation

## Global Navigation

- **Top-left logo:** “Lightning Classics” logo.  
  - **Visual direction:**  
    - Colour palette to evoke *trustworthiness* and *long-established wisdom*:  
      - Deep navy blue (primary) – stability, seriousness.  
      - Warm parchment / cream (background) – evokes paper and classic books.  
      - Muted gold or bronze (accents) – heritage and prestige.  
    - Fonts:  
      - Heading font: classic serif (e.g. in the style of Garamond/Merriweather) to suggest tradition and literature.  
      - Body font: clean, modern sans-serif (e.g. in the style of Inter/Open Sans) for legibility and modern usability.  
  - Logo is clickable and always returns to the **Search** tab / home.

- **Primary navigation tabs** (right of the logo or top-centred):  
  - **Search**  
  - **Add Book**  
  - **FAQ**  

- The selected tab is visually highlighted (e.g. underlined or bold with accent colour). Navigation between tabs is instant and preserves state where appropriate (e.g. search query remains when switching away and back).

## Layout & Consistency

- Each tab shares a consistent layout:
  - Page title and short description near the top.
  - Main interactive content centred with margins for readability.
  - Buttons use consistent styles:
    - Primary actions in primary colour (e.g. deep navy with white text).
    - Secondary actions in neutral tones (e.g. light grey border, text in dark grey).
  - Feedback states (success, error, loading) are consistently styled and clearly distinct.

- The app should be designed for:
  - **Desktop, tablet, and mobile** (responsive layout).  
  - **Accessible interaction**, including keyboard navigation and screen-reader friendly structure (clear headings, labelled controls).

---

# Functional Requirements

## 1. Search Tab

### 1.1 Purpose

Allow users to search the existing Lightning Classics library and review book details, with simple pagination and expandable author/summary sections.

### 1.2 Search Behaviour

- **Search input:** single text field with placeholder text:  
  *“Search by title, author, year, era, country, category, work type, or tags…”*

- **Search scope:**  
  - All terms in the **Book** data table are searchable:  
    - Title  
    - Author  
    - Year  
    - Era  
    - Country  
    - Category  
    - Work Type  
    - Summary (optional match)  
    - Author Bio (optional match)  
    - Themes/Tags  
    - Source  
    - Public Domain flag (e.g. users may search “public domain” or “out of copyright”).

- **Matching rules (minimum behaviour):**
  - Simple keyword matching (case-insensitive).  
  - Support for multiple words; by default treat them as **AND** across searchable fields (e.g. “Tolstoy war” should match “Leo Tolstoy – War and Peace”).  
  - Partial matches: matching should work on substrings, not just exact phrases (e.g. “Dickens” matches “Charles Dickens”).

- **Search trigger:**
  - Typing and pressing **Enter** or clicking a “Search” button starts the search.  
  - Optionally: a small hint may say “Press Enter to search”.

### 1.3 Search Results List

- Results are shown as a list or grid of **book cards** (10 per page).  
- Each result displays **key information**:
  - Title (prominent)  
  - Author  
  - Year, Era (if known)  
  - Country  
  - Category  
  - Work Type  
  - One-line indication of public-domain status (e.g. *“Public domain – free to read”* or *“Not confirmed”*).  
  - A **tags snippet** (up to 3 themes/tags shown as small pills/chips).

- For each book in the results list, there are **two buttons**:
  1. **“Author details”**  
     - When clicked, reveals a text box / collapsible panel **inline within the card**.  
     - Content: a 40–60 word author biography (from the book record).  
     - Clicking again toggles/collapses the text box.
  2. **“Book summary”**  
     - When clicked, reveals a text box / collapsible panel inline.  
     - Content: a 120–150 word summary of the book (from the book record).  
     - Clicking again toggles/collapses the text box.

- Only one or both text boxes may be open at a time per book; the exact behaviour (multiple open vs auto-collapse others) is configurable but should be consistent across the app.

### 1.4 Pagination

- Results are displayed **10 books per page**.
- Pagination controls appear below the results list:
  - `<<` **Back to start** – jumps to page 1.  
  - `<` **Back a page** – moves to previous page (disabled on page 1).  
  - `>` **Forward a page** – moves to next page (disabled on last page).  
  - `>>` **To last page** – jumps to the last page of results.

- Current page information (e.g. “Page 2 of 7”) is displayed between or near the buttons.

- When a search is performed:
  - The current page resets to **page 1**.  
  - If there are **no results**, show a clear “no results” message and a call to action to **Add Book**.

### 1.5 Empty State & Add Book Prompt

- When no books match the search criteria:
  - Display message: *“We couldn’t find any books matching your search in Lightning Classics.”*  
  - Below that, a prompt: *“Think this book should be here? Add it to the library.”*  
  - A **button** takes the user directly to the **Add Book** tab, optionally pre-filling the title/author field with the search query if a reasonable assumption can be made.

---

## 2. Add Book Tab

### 2.1 Purpose

Allow users to propose a new book. The system will use ChatGPT to:

1. Search for the book.  
2. Check if the book exists and appears to be out of copyright / public domain.  
3. If eligible, generate structured book data (including author bio and summary) and present this to the user for confirmation before adding it to the library.

### 2.2 Initial Add Book Form

- Fields:
  - **Title** (text, required)  
  - **Author** (text, required)

- Helper text under the fields:
  - *“Enter the title and author of the book you’d like to add. We’ll look it up and help you add it to the library if it’s out of copyright.”*

- Buttons:
  - **“Search for book”** (primary) – initiates the ChatGPT-assisted lookup.  
  - **“Reset”** (secondary) – clears the form.

### 2.3 ChatGPT Lookup & Copyright Check

- On “Search for book”:
  - The app sends the **Title** and **Author** (and optionally any additional context) to ChatGPT.  
  - ChatGPT attempts to:
    1. Identify the correct work.  
    2. Confirm whether it appears to be **public domain / out of copyright** in the primary jurisdiction(s) the app cares about (to be defined later).  
    3. Generate a structured response including:
       - Title  
       - Author  
       - Year of first publication  
       - Era  
       - Country  
       - Category  
       - Work Type  
       - Summary (120–150 words)  
       - Author Bio (40–60 words)  
       - Themes/Tags (list of short phrases)  
       - Source URL (e.g. Project Gutenberg)  
       - Public Domain flag (Yes/No)  
       - Any notes/uncertainties (e.g. *“Copyright status unclear in some regions…”*).

- While the request is in progress:
  - Show a loading state: *“Looking up your book and checking copyright status…”*

### 2.4 Result Display & User Confirmation

Once ChatGPT returns a candidate book:

- Show a **read-only preview** of the structured data in a clear layout. For example:

  - **Book Details**
    - Title  
    - Author  
    - Year  
    - Era  
    - Country  
    - Category  
    - Work Type  
    - Public Domain (Yes/No + short explanation)  
    - Source URL

  - **Summary** (120–150 words)  
  - **Author Bio** (40–60 words)  
  - **Themes/Tags** (list of tags)

- If the book is **not** determined to be public domain:
  - The interface clearly highlights that it **cannot be added** to the public library.  
  - Only **“Cancel”** and **“Refine”** buttons are offered (see below).  
  - A short explanatory note is shown: e.g. *“This book does not appear to be in the public domain, so we can’t add it to Lightning Classics.”*

- If the book is determined to be **public domain**, three buttons are available:

  1. **“Add this book”** (primary)  
     - Saves the structured record into the Lightning Classics library (Book data store).  
     - On success:
       - Show a confirmation message: *“This book has been added to Lightning Classics.”*  
       - Optionally provide a link: *“Go to this book in Search”* or redirect user to Search tab with the new book highlighted.

  2. **“Refine”**  
     - Takes the user back to the **Title/Author input** form.  
     - The form is pre-filled with the **current search criteria** so the user can refine them (e.g. tweak the title, add a subtitle, fix spelling).  
     - The previous ChatGPT result may be discarded or stored as part of an audit trail (implementation choice).

  3. **“Cancel”**  
     - Discards the current lookup and returns the user to the **Search** tab or a neutral Add Book state (to be defined, but behaviour must be consistent).  
     - No data is saved to the library.

### 2.5 Error & Edge Cases

- If ChatGPT cannot confidently identify the book or returns ambiguous results:
  - Show an error/uncertainty: *“We couldn’t confidently identify this book. Please refine the title and author or provide more detail.”*  
  - The user stays on the **Add Book** form (with their inputs intact).

- If ChatGPT or connectivity fails:
  - Show a message: *“Something went wrong while searching for this book. Please try again later.”*  
  - No partial record is saved.

- If the user attempts to “Add this book” but the book already exists in the library (duplicate detection based on title/author/year):
  - Show a warning: *“This book already exists in Lightning Classics.”*  
  - Provide a link to the existing entry rather than creating a duplicate.

---

## 3. FAQ Tab

### 3.1 Purpose

Provide answers to common questions about Lightning Classics in a clear and interactive way, reducing support needs and building trust.

### 3.2 Behaviour

- The FAQ page lists **frequently asked questions** as clickable items (e.g. in an accordion or collapsible list).  
- When a question is clicked:
  - The answer is displayed directly beneath it.  
  - Clicking again toggles/hides the answer.  
  - Multiple answers may be open at once (configurable), but behaviour must be consistent.

### 3.3 Example FAQ Content (Initial Set)

1. **What is Lightning Classics?**  
   - *Answer:* Lightning Classics is a curated online library of classic literature drawn from public-domain works. It helps readers discover important books, understand them quickly through summaries and author bios, and grow the catalogue over time using an AI-assisted Add Book feature.

2. **How do you decide which books to include?**  
   - *Answer:* We focus on classic works of literature that are in the public domain. When a book is proposed through the Add Book flow, we use AI and supporting sources to check its publication date and copyright status before adding it to the library.

3. **Are all books on Lightning Classics free to read?**  
   - *Answer:* Our goal is to include only works that are in the public domain, meaning they are generally free to read and share. Each entry includes a public-domain flag and a link to an external source (such as Project Gutenberg) where you can access the text.

4. **Can I suggest a book that isn’t in the library?**  
   - *Answer:* Yes. Use the **Add Book** tab, enter the title and author, and we’ll help you look it up. If the book is in the public domain and we can find enough information, you’ll have the option to add it to the library.

5. **What if the information about a book is wrong or incomplete?**  
   - *Answer:* While we use reliable sources and AI assistance, errors can happen. A future version of the app can include a “Report an issue” option on each book. For now, the FAQ should explain how users can contact the maintainers (e.g. via email) to suggest corrections.

6. **Which regions’ copyright rules do you follow?**  
   - *Answer:* Lightning Classics is initially focused on works that are generally recognised as public domain in major English-language jurisdictions. Copyright law is complex and varies by country, so users should always confirm whether a work is public domain in their own region before reuse.

7. **Do I need an account to use Lightning Classics?**  
   - *Answer:* No account is required to search the library or view FAQs. Accounts may be introduced in the future for features such as favourites, reading lists, or commenting.

8. **How do you use AI in Lightning Classics?**  
   - *Answer:* We use ChatGPT to help look up proposed books, check whether they are likely to be in the public domain, and generate concise summaries and author biographies. Human review and external sources are still important, and we treat AI output as a starting point rather than a final authority.

(Additional questions can be added over time; the FAQ structure must make it easy to insert, reorder, or remove entries.)

---

# Data Schema

The **data schema** described below is logical/abstract, not tied to a specific database technology. It defines all information required for the app’s core behaviour.

## 1. Book

Represents a single work of classic literature in the main library.

**Fields**

- `id` – Unique identifier (string/UUID).  
- `title` – Book title (string).  
- `author` – Main author name (string).  
- `year` – Year of first publication (integer, nullable).  
- `era` – Literary/historical era (string, e.g. “Victorian”, “Romantic”).  
- `country` – Country associated with the work or main author (string).  
- `category` – Broad category of work (string, e.g. “Fiction”, “Drama”, “Poetry”).  
- `workType` – Specific type (enum-like string):  
  - Allowed values (initially): `"Novel"`, `"Play"`, `"Poem"`, `"Essay"`, `"Collection"`, `"Short Story"`, `"Other"`.  
- `summary` – Summary of the work (string, ideally 120–150 words).  
- `authorBio` – Short biography of the author relevant to this work (string, 40–60 words).  
- `tags` – List of themes/topics (array of short strings, e.g. `["coming of age", "war", "satire"]`).  
- `source` – URL pointing to a canonical online version of the text (string, e.g. Project Gutenberg link).  
- `publicDomain` – Boolean flag indicating whether the work is believed to be public domain (true/false).  
- `publicDomainNotes` – Optional explanation or jurisdiction notes (string, nullable).  

**Metadata / system fields** (recommended):

- `createdAt` – Timestamp when the book was added to the library (ISO-8601 string).  
- `updatedAt` – Timestamp when the book record was last updated (ISO-8601 string).  
- `addedBy` – Optional: identifier (or free-text) indicating who/what added the book (e.g. “system”, “chatgpt-flow”, or a user id).  
- `acquisitionMethod` – Optional: `"manual"`, `"chatgpt-assisted"`, `"import"`, etc.

**Search helper fields** (implementation detail, but part of logical schema for clarity):

- `searchIndex` – Concatenated, normalised string of title, author, tags, and other searchable fields to support simple full-text search (string).  
- `titleNormalized` – Lowercased, punctuation-stripped title for efficient comparisons (string).  
- `authorNormalized` – Lowercased, punctuation-stripped author name (string).

## 2. Author (Optional Separate Entity)

If the app later needs to handle authors independently (e.g. multiple books per author with richer metadata), a separate `Author` entity may be introduced. For now, the fields are included redundantly in `Book`, but the proposed schema is:

- `authorId` – Unique identifier (string).  
- `name` – Author full name (string).  
- `shortBio` – 40–60 word biography (string).  
- `birthYear` – Integer, nullable.  
- `deathYear` – Integer, nullable.  
- `country` – Primary country/region (string).  
- `primaryEra` – Literary/historical era (string).  
- `externalLinks` – Optional list of URLs (array of strings, e.g. Wikipedia, encyclopaedia).  
- `createdAt`, `updatedAt` – Timestamps.

In the current requirements, it is acceptable to store author-specific data (short bio, dates) directly on the `Book` entity and later migrate to a separate `Author` entity if needed.

## 3. Add Book Request / Audit (Optional but Recommended)

To support traceability of AI-assisted additions, define an `AddBookRequest` entity (even if not exposed to the UI).

- `requestId` – Unique identifier (string).  
- `inputTitle` – Title entered by the user (string).  
- `inputAuthor` – Author entered by the user (string).  
- `resolvedBookId` – The `Book.id` if the book was successfully added (string, nullable).  
- `chatgptResponseRaw` – Stored representation of ChatGPT’s structured response (JSON/text, optional depending on privacy policies).  
- `status` – `"pending"`, `"resolved"`, `"failed"`.  
- `createdAt` – Timestamp of request.  
- `createdBy` – Optional user identifier or “anonymous”.  

Even if not implemented initially, this schema section makes clear what information is useful for future moderation and debugging.

## 4. FAQ Entry

Represents a question/answer pair on the FAQ page.

- `faqId` – Unique identifier (string).  
- `question` – The FAQ question (string).  
- `answer` – The FAQ answer (string, may contain basic formatting such as paragraphs or lists).  
- `order` – Integer indicating display order (lower appears first).  
- `isActive` – Boolean to allow hiding/deactivating entries without deleting.  
- `createdAt` – Timestamp.  
- `updatedAt` – Timestamp.

FAQ content may initially be hard-coded but this schema defines how it could be represented if stored in a data source later.

---

# Non-Functional Requirements (High-Level)

Even though technology is not yet chosen, the following qualities are desired:

- **Performance:**  
  - Search results should appear quickly (target: perceivable response within ~0.5–1s under typical load).  
  - Pagination and FAQ toggles should feel instant.

- **Accessibility:**  
  - Semantic HTML structure (headings, lists, buttons).  
  - Keyboard navigation for all interactive elements (including tab navigation, FAQ toggles, author/summary dropdowns).  
  - High-contrast colour palette and readable font sizes.

- **Reliability & Error Handling:**  
  - Clear, user-friendly error messages when searches fail or when AI-assisted lookups cannot complete.  
  - No silent failures; any inability to add a book should be explained in simple language.

- **Privacy & Data Handling:**  
  - If user-identifying data (e.g. accounts) is added later, it must be handled in line with relevant privacy regulations.  
  - At present, the Add Book flow does not require personal information; future extensions may add optional contact options for corrections.

- **Scalability:**  
  - Data model and app structure should support growth to many thousands of books, multiple tags and eras, and a larger FAQ.

---

# Open Questions & Assumptions

These should be resolved before or during implementation:

1. **Primary Jurisdiction for Public Domain:**  
   - Which country’s copyright rules are the primary reference? (e.g. US, UK, EU).  
   - How will the app communicate jurisdictional differences to users?

2. **Moderation / Review Process:**  
   - Is every ChatGPT-assisted “Add Book” accepted automatically, or is there a human review step before the record becomes public?  
   - If there is review, what is the workflow and where is its status tracked?

3. **Future Features:**  
   - User accounts, favourites, book discussions, reading lists, and reporting/correction flows are out of scope for the initial product but should be kept in mind for design choices (e.g. avoid decisions that make accounts impossible later).

4. **Analytics:**  
   - How will search queries, added books, and FAQ usage be logged for product improvement?  
   - What metrics will be monitored regularly (e.g. search success, number of books added per month)?

---

# Summary

This document defines the **product brief**, **user experience**, and **data schema** for Lightning Classics as a classic literature discovery and library growth app. It is intentionally technology-agnostic to allow flexibility in implementation while ensuring that any chosen stack can conform to:

- A clear three-tab UX (Search, Add Book, FAQ).  
- A consistent look and feel anchored by a trusted, literature-inspired visual identity.  
- A comprehensive data model that supports robust search, AI-assisted book addition, and transparent FAQ communication.

With this specification in hand, designers, developers, and stakeholders should have a shared understanding of what Lightning Classics must do and how users will experience it.
