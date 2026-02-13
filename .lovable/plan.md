# REID Data Portal — Implementation Plan

## Phase 1: UI Shell & Visual Identity (This Implementation)

### 1. Global Design System

- Warm cream/beige background (#fbf5ea), Charcoal text (#000000) golden-amber accents  (#fdcb7f) matching the reference designs
- Clean, institutional typography ("poppins" - google fonts) with generous whitespace
- Consistent card styling with soft shadows and rounded corners

### 2. Collapsible Sidebar

- REID BASE logo at top with collapse toggle
- Navigation items: New Analysis (⊕), Dashboard (📈), Market Reports (📄), Location Reports (📍), Appraisal Request (📋)
- "Recent Analysis" section with search icon and example chat history entries
- User profile at bottom showing name (From Wix membership) and tier badge (From Wix membership)
- Collapsed state shows icons only (as shown in the reference images)

### 3. New Analysis Page (Home/Landing)

- Hero heading: "Welcome to REID, what would you like to discover"
- Large text input area with golden arrow submit button
- Four suggested prompt cards below: "Market trends," "Top markets," "Emerging locations," "Yield estimator" — each with description and arrow
- Chat dialogue view: user messages in amber bubbles (right-aligned), AI responses as formatted text (left-aligned)
- "Conversation name" dropdown at top with Pin/Rename options
- Bottom prompt input bar pinned to bottom of content area

### 4. Dashboard Page

- iframe for Looker dashboard embedding

### 5. Market Reports & Location Reports Pages

- Grid of report cards (4 columns) showing location names (Based on loaded PDF)
- Cards display JPEG to be uploaded of report cover
- Label underneath: location name + "2024 Annual Report"
- Search/filter functionality for the grid

### 6. Appraisal Request Page

- Heading: "Discover your property fair market value."
- Form fields in a clean grid layout:
  - Property Type, Location, Property Description (textarea)
  - Ownership Type, Land Zone
  - Lease Term, Land Size
  - Internal Size, Property Status
  - Number of Bedrooms, Number of Bathrooms, Year Built
  - Currently Operational, Property Website
  - Average Daily Rate, Average Occupancy, Years Operating
  - Property Files upload area
- **Conditional expansion**: When Property Status = "Under Construction", show additional budget fields (Construction, Consultant, FF&E, Landscaping, Overheads)
- Golden "SUBMIT →" button

### 7. Tier Gating / Upgrade Overlay (Mock)

- Semi-transparent overlay modal with "Upgrade to access insights" heading
- Golden "SEE PLANS" button
- Description: "Subscribers access location reports, interactive data, and full AI access."
- Applied over restricted pages when user tier is insufficient (using mock tier state)
- Tier logic: Member → New Analysis only; REID Base → +Dashboard; REID Base Pro → +Location Reports; Enterprise → +Appraisal + Advanced Search

### 8. Routing

- `/` — New Analysis
- `/dashboard` — Dashboard
- `/market-reports` — Market Reports
- `/location-reports` — Location Reports
- `/appraisal-request` — Appraisal Request
- All wrapped in sidebar layout

## Phase 2 (Future — Not This Implementation)

- Wix Headless SDK authentication integration
- Supabase tables (properties_2025, appraisal_requests)
- PDF upload to Supabase Storage + text indexing
- Lovable AI Gateway integration for RAG and Analytical search modes
- Looker Dashboard iFrame embedding
- Real tier gating tied to Wix membership plans