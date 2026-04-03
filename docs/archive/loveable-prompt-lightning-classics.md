# Loveable Prompt – Lightning Classics App

Paste this prompt directly into **Loveable** to generate the Lightning Classics app.

---

## 🎯 **Project: Lightning Classics**

You are a senior full-stack engineer.  
Build a production-ready web app called **Lightning Classics** based entirely on the specification below.

---

# 1. Product Overview

**Lightning Classics** is a classic literature discovery app and growing library of public‑domain books.

Core goals:

- Users can **search and browse** books already in the library.
- Users can **add missing books** through an **AI‑assisted Add Book flow** using ChatGPT.
- Users can read answers to common questions in an interactive **FAQ** page.

This specification is **technology‑agnostic**; choose a strong modern full‑stack approach (e.g., React or Vue with a lightweight backend) and implement it as a working app.

---

# 2. Visual & UX Guidelines

### Branding

- Logo text (top-left): **Lightning Classics**
- Style evokes *trust, heritage, and literary tradition*.

**Palette**
- Deep navy blue (primary)
- Warm parchment / cream (background)
- Muted gold / bronze (accents)

**Fonts**
- Headings: classic serif (e.g., Garamond-style)
- Body: clean sans-serif (e.g., Inter / Open Sans)

### Navigation

Across the top:

- **Lightning Classics** logo (home)
- Three tabs:
  - **Search**
  - **Add Book**
  - **FAQ**

Consistent, responsive, accessible layout across desktop, tablet, and mobile.

---

# 3. Functional Requirements

---

## 3.1 SEARCH TAB

### Purpose
Search & browse the existing library.

### Search behaviour

- Single search field with placeholder:  
  _“Search by title, author, year, era, country, category, work type, or tags…”_
- Press **Enter** or **Search** button to execute.
- **All fields in Book schema must be searchable**:
  - title  
  - author  
  - year  
  - era  
  - country  
  - category  
  - workType  
  - summary  
  - authorBio  
  - tags  
  - source  
  - publicDomain  

### Matching rules

- Case‑insensitive  
- Substring search  
- Multiple keywords treated as **AND** across fields  

### Search results

Books displayed as **cards** showing:

- Title  
- Author  
- Year, Era  
- Country  
- Category  
- Work Type  
- Public Domain status  
- Up to 3 tags as chips  

Each card includes:

1. **Author details** button → toggles a 40–60 word author bio  
2. **Book summary** button → toggles a 120–150 word summary  

These expandable text boxes appear inline.

### Pagination

- 10 results per page  
- Navigation buttons: `<<` `<` `>` `>>`  
  - First page, Previous, Next, Last  
- Display current position e.g. *“Page 2 of 7”*

### Empty state

If no results, show:

- _“We couldn’t find any books matching your search.”_
- Button: **Add this book** → navigates to Add Book tab  
  - Prefill guessed title/author if appropriate  

---

## 3.2 ADD BOOK TAB

### Purpose
AI‑assisted flow to add books to the library.

### Initial form

Fields:

- **Title** (required)  
- **Author** (required)

Buttons:

- **Search for book**  
- **Reset**

Helper text:  
_“Enter the title and author. We’ll look it up and help you add it if it’s out of copyright.”_

---

### ChatGPT Lookup

When user clicks **Search for book**, the system sends Title + Author to ChatGPT and requests structured JSON with:

- title  
- author  
- year  
- era  
- country  
- category  
- workType  
- summary (120–150 words)  
- authorBio (40–60 words)  
- tags[]  
- source URL  
- publicDomain (boolean)  
- publicDomainNotes  

Display loading message while waiting.

---

### Result Display

If ChatGPT finds a match:

Show a structured preview including:

- Book metadata  
- Public domain status + explanation  
- Summary  
- Author bio  
- Tags  

If **publicDomain = true**, show:

- **Add this book**  
- **Refine** → returns to form with inputs prefilled  
- **Cancel** → return to neutral Add Book state  

If **publicDomain = false**:

- Show copyright warning  
- Only show:
  - **Refine**
  - **Cancel**

### Edge Cases

- If ChatGPT cannot identify a book → Show:  
  _“We couldn’t confidently identify this book. Please refine the title or provide more detail.”_

- If the book already exists in library →  
  _“This book already exists in Lightning Classics.”_  
  Provide link to existing record.

---

## 3.3 FAQ TAB

FAQ page lists questions as clickable items.  
Click → toggles answer (accordion-style, multiple open allowed).

Seed the FAQ with:

1. What is Lightning Classics?  
2. How do you decide which books to include?  
3. Are all books free to read?  
4. Can I suggest a book?  
5. What if information is incomplete or incorrect?  
6. Which copyright rules apply?  
7. Do I need an account?  
8. How do you use AI?  

Structure FAQ entries so they can later come from data.

---

# 4. Data Model

Below is the app’s required data schema.

---

## 4.1 Book Schema

```ts
type Book = {
  id: string;
  title: string;
  author: string;
  year?: number | null;
  era?: string | null;
  country?: string | null;
  category?: string | null;
  workType: "Novel" | "Play" | "Poem" | "Essay" | "Collection" | "Short Story" | "Other";
  summary: string;
  authorBio: string;
  tags: string[];
  source?: string | null;
  publicDomain: boolean;
  publicDomainNotes?: string | null;

  createdAt: string;
  updatedAt: string;

  // Optional helpers for search
  searchIndex?: string;
  titleNormalized?: string;
  authorNormalized?: string;
};
```

---

## 4.2 FAQ Schema

```ts
type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
};
```

---

# 5. Additional Requirements

### Performance
- Search results should feel instant (<1s typical).

### Accessibility
- Semantic HTML  
- Keyboard-navigable  
- High contrast palette  

### Reliability
- Clear error handling for API and ChatGPT failures.

### OpenAI Integration
- Add Book flow must call ChatGPT with a system prompt requesting structured JSON.
- Provide environment variable for API key in the README.

---

# 6. Deliverables (Loveable should generate)

- Full working full-stack web app with:
  - Search tab  
  - Add Book tab with ChatGPT integration  
  - FAQ tab  
- Beautiful, trustworthy UI following palette & typography  
- README with full setup instructions  
- Seed data (a few classic books) so Search works immediately  

---

# End of Prompt
Use your best engineering judgment for any ambiguous areas, staying faithful to this behaviour and UX.
