# jw-schedule — Specification (for review)

> Static front-end (vanilla HTML/CSS/JS), hosted on GitHub Pages.
> Backend is abstract for now — dummy data + JSON import cached in the browser
> (`localStorage`). Later swapped for **Zoho Catalyst DB** by changing one
> adapter (`js/store.js` → `CatalystBackend`). No server code lives in this repo.

---

## 1. Authentication & congregations

| Topic | Decision |
|---|---|
| Login | **Google Sign-In (recommended)** via Google Identity Services — client-side only, no backend. Username/password kept as a fallback option only. |
| New congregation | On login a user may **create a new congregation**. That congregation gets its own isolated dataset. The creator becomes its **owner/admin**. |
| Joining an existing congregation | A user cannot self-join. The **owner adds the user's email** and grants them specific permissions. |
| Enforcement (now) | Local only — access rules live in the dataset in `localStorage`. |
| Enforcement (later) | Real per-user access control enforced by Catalyst DB. |

### Permissions model

Five schedule areas, each with independent **View** and **Edit** rights:

| # | Permission area | Key |
|---|---|---|
| 1 | CLM Schedule (Our Christian Life & Ministry) | `clm` |
| 2 | Audio / Video Schedule | `av` |
| 3 | Cleaning Schedule | `cleaning` |
| 4 | Field Service Meeting Schedule | `fsm` |
| 5 | Attendant Schedule | `attendant` |

A user's access is a map, e.g.:
```json
{
  "clm":       { "view": true,  "edit": true  },
  "av":        { "view": true,  "edit": false },
  "cleaning":  { "view": false, "edit": false },
  "fsm":       { "view": true,  "edit": true  },
  "attendant": { "view": true,  "edit": false }
}
```

---

## 2. Publishers (the shared people list)

Every schedule draws its names from one shared publisher list.

| Field | Type | Notes |
|---|---|---|
| `id` | string | stable id |
| `name` | string | display name (Tamil) |
| `gender` | `"brother"` \| `"sister"` | drives the `Br.` / `Sr.` prefix and which roles are eligible |
| `groupId` | string | field-service group they belong to |
| `roles` | string[] | which assignments they're qualified for (keys below) |
| `active` | bool | inactive publishers hidden from dropdowns |

### Role keys per area

**CLM** (`clm`)
- `clm.chairman` — Chairman
- `clm.prayer` — Starting Prayer
- `clm.treasures` — Treasures Talk
- `clm.gems` — Spiritual Gems
- `clm.student` — Theocratic Ministry School – Student
- `clm.living` — Living as Christians – Discussion
- `clm.cbs.conductor` — Congregation Bible Study – Conductor
- `clm.cbs.reader` — Congregation Bible Study – Reader

**Audio / Video** (`av`)
- `av.console` — Console
- `av.stage` — Stage
- `av.roving` — Roving (mic)

**Field Service Meeting** (`fsm`)
- `fsm.conductor` — FSM Conductor

**Attendant** (`attendant`)
- `attendant.attendant` — Attendant

> Dropdowns for each slot are filtered to publishers who hold the matching role
> (and, where relevant, the right gender — e.g. student demonstrations are
> sisters/brothers per the part).

---

## 3. Field service groups

| Field | Type |
|---|---|
| `id` | string |
| `name` | string (e.g. "Group 1") |
| `overseerId` | publisher id (Group Overseer / Servant) |
| `assistantId` | publisher id (optional) |

---

## 4. CLM schedule — data shape (the printed sheet)

The printed sheet is a **month view**: up to 5 week-cards side by side. Each
week (`meeting`) is one midweek program:

```jsonc
{
  "id": "w1",
  "date": "2026-08-05",
  "chairman": "<pubId>",
  "openingPrayer": "<pubId>",
  "closingPrayer": "<pubId>",
  "sections": {
    "treasures": [                                  // பைபிளில் இருக்கும் புதையல்கள்
      { "no": 1, "min": 10, "assignee": "<pubId>" },
      { "no": 2, "min": 10, "assignee": "<pubId>" },
      { "no": 3, "min": 4,  "assignee": "<pubId>" }   // Bible Reading (student)
    ],
    "apply": [                                      // ஊழியத்தை நன்றாகச் செய்யுங்கள்
      { "no": 4, "min": 4, "assignee": "<pubId>", "assistant": "<pubId>" },
      { "no": 5, "min": 4, "assignee": "<pubId>", "assistant": "<pubId>" },
      { "no": 6, "min": 4, "assignee": "<pubId>" }
    ],
    "living": [                                     // கிறிஸ்தவர்களாக வாழுங்கள்
      { "no": 7, "min": 15, "title": "சபைத் தேவைகள்" },        // local needs = plain title, no person
      { "no": 8, "min": 30, "assignee": "<pubId>", "reader": "<pubId>" } // CBS: conductor + வாசிப்பு reader
    ]
  }
}
```

**Rules derived from your sample sheet (August 2026):**
- A section can hold a **variable number of parts** (week 4 has parts 7, 8 **and** 9).
- An "apply" part is either a **talk** (one name) or a **demonstration** (a
  pair: `assignee` + `assistant`).
- A "living" part is either a person, or a **plain title** like *சபைத் தேவைகள்*
  (local needs) with no name.
- The **CBS** part carries both a conductor (`assignee`) and a reader
  (`reader`, labelled *வாசிப்பு*).
- Closing prayer (*ஜெபம்*) shown at the bottom of each week.

### Section headers (Tamil + colour + icon)

| Section | Tamil header | Accent | Icon |
|---|---|---|---|
| Treasures | பைபிளில் இருக்கும் புதையல்கள் | teal | 💎 diamond |
| Apply | ஊழியத்தை நன்றாகச் செய்யுங்கள் | gold/amber | 🌾 wheat |
| Living | கிறிஸ்தவர்களாக வாழுங்கள் | red | 🐑 sheep |

Row labels: `சேர்மன்` (Chairman), `ஜெபம்` (Prayer), `வாசிப்பு` (Reading).
Title line: `<Congregation> சபையின் - நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்திற்கான அட்டவணை` + month/year.

The print/export will be a **1:1 copy of the sample image**, font
**Noto Sans Tamil**, exported as a fixed-A4-landscape PDF via
`html2canvas → jsPDF` (see §6).

---

## 5. Other schedules (same publisher list)

- **Audio / Video** — per meeting date: Console, Stage, Roving.
- **Cleaning** — per week: group + area.
- **Field Service Meeting** — per session: date, time, place, FSM Conductor.
- **Attendant** — per meeting: attendant(s).

(Exact printed layouts for these TBD — CLM is the priority pixel-match.)

---

## 6. Print / export — uniform across devices

**Decision: server-side PDF on Catalyst AppSail. NOT html2canvas.**
(html2canvas rasterizes via a JS re-implementation of the browser — blurry
text, fragile fonts/CORS, broken Tamil shaping. It is the source of the current
Sound Schedule export problems. Do not reuse it.)

Architecture — design lives in one place, server is a dumb converter:

```
Browser  builds the exact CLM sheet as HTML + inlined CSS  ──POST──▶  AppSail
AppSail  HTML ──(renderer + embedded Noto Sans Tamil .ttf)──▶ PDF ──▶  Browser downloads
```

- The client sends the **rendered HTML** (not just data) so the on-screen
  preview and the PDF are the *same markup* → true WYSIWYG, no duplicated
  template.
- The Noto Sans Tamil **`.ttf` is bundled and embedded** in the service — never
  fetched from the CDN at render time.

**Renderer: `SmartBrowz`** (in-house — `zoho-services-library/catalyst/smart-browz`).
It wraps **Selenium 4.27 + headless Chrome** (`RemoteWebDriver`). This is the
real browser engine ⇒ perfect Tamil shaping (HarfBuzz), vector-crisp text,
identical on every device. No license (unlike iText pdfCalligraph), no
rasterization (unlike html2canvas).

PDF is produced via Selenium 4's native printing (Chrome `Page.printToPDF`):

```java
SmartBrowz.headless(gridUrl, driver -> {
    driver.get("data:text/html;charset=utf-8," + encodedHtml); // self-contained sheet
    PrintOptions opts = new PrintOptions();
    opts.setPageSize(new PageSize(29.7, 21.0));   // A4 landscape (cm)
    opts.setBackground(true);
    opts.setPageMargin(new PageMargin(0, 0, 0, 0));
    Pdf pdf = ((PrintsPage) driver).print(opts);
    return Base64.getDecoder().decode(pdf.getContent());
});
```

**Works before Catalyst DB exists:** the browser assembles the sheet HTML from
local data (localStorage) and POSTs the *finished, self-contained* HTML — CSS
inlined, **Noto Sans Tamil embedded as base64 `@font-face`**. The headless
browser never needs to see the data; it only renders finished HTML.

Front-end impact: the export button POSTs self-contained sheet HTML to the
AppSail endpoint. The pixel-perfect HTML/CSS CLM sheet is built in the web app
and doubles as the live preview.

---

## 7. Planned file structure (no single mega-file)

```
index.html            # shell only
css/
  base.css            # reset, tokens, typography
  app.css             # layout, sidebar, components
  print-clm.css       # the CLM sheet styling (pixel-matched)
js/
  seed.js             # dummy data  ✅ (will be updated to Aug-2026 Tamil sample)
  store.js            # abstract backend + DataService  ✅
  auth.js             # Google Sign-In + congregation/permissions
  router.js           # hash routing
  views/
    dashboard.js
    clm.js            # CLM editor + print sheet
    av.js  cleaning.js  fsm.js  attendant.js
    publishers.js  groups.js  access.js
  export.js           # builds sheet HTML → POST to AppSail → download PDF
docs/
  SPEC.md             # this file
```

---

## 8. Open questions for you

1. **Weekend meeting** (Public Talk + Watchtower) — in scope, or CLM midweek only for now?
2. **Language** — Tamil only, or English/Tamil toggle?
3. **Print sizes for the other schedules** — do you have reference sheets like the CLM one, or design freely?
4. Confirm the **5 permission areas + roles** above are complete and correctly named.
