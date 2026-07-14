# jw-schedule — Frontend feature plan (checklist)

## Global shell
- Top bar: congregation switcher, month navigator (◀ Aug 2026 ▶), user menu (avatar/email/logout), sync status dot (saved / saving / offline).
- Left sidebar: tab nav with per-area icons; hides tabs the user has no `view` on.
- Read-only badge on tabs where the user has view-but-not-edit.
- Command palette (Ctrl/⌘-K): jump to any publisher, week, or tab.
- Dark / light theme toggle. Tamil / English label toggle.
- Toast notifications; global undo (Ctrl-Z) for last edit.

## Login & congregation
- Google sign-in button (primary); email/password fallback.
- "Create congregation" (name → becomes owner).
- "My congregations" list after login (from `GET /me`), each showing role + permissions.
- No self-join: joining shows "ask the owner to add your email".

## Tabs
1. Dashboard
2. CLM (Midweek)
3. Weekend
4. Audio/Video
5. Cleaning
6. Field Service Meeting
7. Attendant
8. Publishers
9. Groups
10. Members & Access (owner only)
11. Settings

---

## 1. Dashboard
- "This week" card: every assignment across all areas for the current week, one glance.
- Gaps panel: unfilled slots this month, per area, click to jump.
- Conflicts panel: double-booked people, missing-qualification assignments.
- Fairness snapshot: most / least used publishers this month.
- Upcoming: next 4 weeks mini-preview.
- Quick actions: Export month PDF, Add week, Import JSON.

## 2. CLM (Midweek) — the pixel-matched sheet
- Month view = up to 5 week-cards side by side (matches the printed image).
- Sections colour-coded: Treasures (teal), Apply (gold), Living (red); Tamil headers + icons.
- Per week: Chairman, Opening prayer, numbered parts (title, minutes, assignee, optional assistant/reader), Closing prayer.
- Assignee cells = smart dropdown filtered by role + gender for that part.
- Add / remove parts (variable count — e.g. weeks with parts 7-8-9).
- "Local needs" part = free-text title (no person).
- CBS part = conductor + reader (வாசிப்பு).
- Buttons: Add week (date picker), Duplicate previous week, Clear week, Export month PDF, Print.
- Inline conflict highlight (red) + qualification warning (amber).
- Auto-suggest button per slot: "least-recently-used qualified brother".

## 3. Weekend
- Public Talk: title/number, speaker (own or **visiting from another congregation** — free-text name + congregation), host chairman.
- Watchtower: Conductor, Reader.
- Outgoing speakers tracker (who we send out, where, when).
- Roles: Watchtower Conductor, Watchtower Reader, Public Talk speaker.
- Buttons: Add weekend, Export PDF.

## 4. Audio/Video
- Per meeting date: Console, Stage, Roving (mic).
- Roles: `av.console`, `av.stage`, `av.roving`.
- Roster grid month view; duplicate-week; export.

## 5. Cleaning
- Per week: group + area/zone.
- Rotate groups automatically (round-robin) button.
- Export month PDF.

## 6. Field Service Meeting
- Per session: date, time, place/point, FSM Conductor.
- Recurring generator (e.g., every Sat 9:00) to bulk-create a month.

## 7. Attendant
- Per meeting: attendant(s), position (door / auditorium).
- Rotate / balance across the month.

## 8. Publishers
- Table: name, gender (Br./Sr.), group, roles (chips), active toggle, search + filter by role/group.
- Add / edit / deactivate; bulk import from JSON.
- **Publisher profile drawer (click a name):**
  - assignment history: every past part with date + area.
  - "Last did X on <date>" per role.
  - frequency counts per role (this month / all time).
  - **partners**: who they were paired with (student assistants, mic pairs) + counts.
  - workload bar vs congregation average (over/under-used).
  - unavailable dates / notes.
  - one-click "assign to next open slot they qualify for".

## 9. Groups
- List groups: name, overseer, assistant, member count.
- Assign publishers to a group (drag or select).
- Add / edit / delete group.

## 10. Members & Access (owner only)
- List members (email) with per-area view/edit matrix (6 areas × 2).
- Add member by email + set permissions via toggles.
- Revoke access. Transfer ownership.

## 11. Settings
- Congregation name, language default, meeting days/times.
- Export full backup JSON / import / reset.
- PDF options: paper size, orientation, show/hide sections.
- Connection: backend URL, offline mode.

---

## Publisher-intelligence features (assign smarter)
- Click publisher → history, partners, last-used, frequency (as above).
- Per-slot suggestion: rank qualified publishers by "least recently used" + workload.
- Rotation fairness meter per area (spread assignments evenly).
- "Never assigned" and "overdue" flags.
- Partner-pairing memory: avoid always pairing the same two; or keep preferred pairs.
- Availability calendar: mark away dates → excluded from dropdowns + flagged if assigned.
- Gender/role gating on every dropdown (only eligible people shown).

## Cross-cutting nice features
- Conflict engine: same person twice in one meeting, assigned while unavailable, missing role.
- Auto-fill month: one click drafts a fair schedule, you tweak.
- Duplicate/clone: copy last month as a starting point.
- Templates: save a recurring pattern (e.g., cleaning rotation).
- Drag-and-drop reassign between slots.
- Search everything (⌘-K).
- Undo/redo history.
- Offline-first: localStorage cache, syncs to backend when online (dummy data until Catalyst).
- Import/export JSON (per area and whole backup).
- Month PDF per area + combined; identical output via SmartBrowz.
- S-89 assignment-slip generation for student parts.
- Change log: who edited what, when.
- Print-preview modal before export.
- Mobile-friendly responsive layout.
