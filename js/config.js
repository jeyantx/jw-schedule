// ============================================================================
// CONFIG — backend endpoint, domain constants (roles, areas, sections), i18n.
// ============================================================================

// API base — mirrors clipboard's proven pattern:
//   • Local dev  → "" (relative). Run `./gradlew bootRun` (serves BOTH the app and the API at
//                  http://localhost:3000) so it's same-origin ⇒ no CORS.
//   • Production → absolute AppSail URL. The GitHub Pages front-end calls it cross-origin; CORS is
//                  granted by the AppSail project's Authorized Domains (whitelist the exact Pages
//                  origin, e.g. https://<user>.github.io).
// Override anytime with ?api=<url>.
const APPSAIL = "https://jwschedule.development.catalystappsail.in";
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const DEFAULT_API = IS_LOCAL ? "" : APPSAIL;

// ⬇️  Paste your Google OAuth **Web** client ID here to enable Google Sign-In.
//     Looks like:  1234567890-abc123.apps.googleusercontent.com
//     Create it in Google Cloud Console → Credentials → OAuth client (Web),
//     and add your site to "Authorized JavaScript origins" (e.g. https://<user>.github.io
//     and http://localhost:4599 for local dev). No client secret is needed client-side.
const GOOGLE_CLIENT_ID = "676359943294-ou7kj3rvn9n54hgvqbtmvbaq5hfdl2jq.apps.googleusercontent.com";

export const CONFIG = {
  api: (new URLSearchParams(location.search).get("api")
        || localStorage.getItem("jw_api")
        || DEFAULT_API).replace(/\/$/, ""),
  // Precedence: ?gcid= URL param → localStorage → the constant above.
  googleClientId: (new URLSearchParams(location.search).get("gcid")
        || localStorage.getItem("jw_google_client_id")
        || GOOGLE_CLIENT_ID),
};

// Permission areas — each with independent view/edit.
export const AREAS = ["clm", "weekend", "av", "cleaning", "fsm", "attendant"];

// Data documents kept per congregation (stored server-side as JSON per kind).
export const KINDS = ["publishers", "groups", "clm", "weekend", "av", "cleaning", "fsm", "attendant", "meta"];

// CLM sections in order, with their accent + bilingual headers + icon.
export const CLM_SECTIONS = [
  { key: "treasures", en: "Treasures From the Bible", ta: "பைபிளில் இருக்கும் புதையல்கள்", icon: "gem", cls: "treasures" },
  { key: "apply",     en: "Apply Yourself to the Field Ministry", ta: "ஊழியத்தை நன்றாகச் செய்யுங்கள்", icon: "sprout", cls: "apply" },
  { key: "living",    en: "Living as Christians", ta: "கிறிஸ்தவர்களாக வாழுங்கள்", icon: "flame", cls: "living" },
];

// Assignment roles a publisher can be qualified for, grouped by area.
export const ROLES = [
  { key: "clm.chairman",      area: "clm", en: "Chairman", ta: "சேர்மன்" },
  { key: "clm.prayer",        area: "clm", en: "Prayer", ta: "ஜெபம்" },
  { key: "clm.treasures",     area: "clm", en: "Treasures Talk", ta: "புதையல் பேச்சு" },
  { key: "clm.gems",          area: "clm", en: "Spiritual Gems", ta: "ஆன்மீக முத்துகள்" },
  { key: "clm.student",       area: "clm", en: "Student", ta: "மாணவர்" },
  { key: "clm.living",        area: "clm", en: "Living Discussion", ta: "வாழ்க்கை பகுதி" },
  { key: "clm.cbs.conductor", area: "clm", en: "Bible Study Conductor", ta: "பைபிள் படிப்பு நடத்துபவர்" },
  { key: "clm.cbs.reader",    area: "clm", en: "Bible Study Reader", ta: "வாசிப்பாளர்" },
  { key: "weekend.chairman",  area: "weekend", en: "Weekend Chairman", ta: "வார இறுதி சேர்மன்" },
  { key: "weekend.talk",      area: "weekend", en: "Public Talk Speaker", ta: "பொது பேச்சாளர்" },
  { key: "weekend.wt.conductor", area: "weekend", en: "Watchtower Conductor", ta: "காவற்கோபுர நடத்துபவர்" },
  { key: "weekend.wt.reader", area: "weekend", en: "Watchtower Reader", ta: "காவற்கோபுர வாசிப்பாளர்" },
  { key: "av.console",        area: "av", en: "Console", ta: "கன்சோல்" },
  { key: "av.stage",          area: "av", en: "Stage", ta: "மேடை" },
  { key: "av.roving",         area: "av", en: "Roving Mic", ta: "மைக்" },
  { key: "fsm.conductor",     area: "fsm", en: "Field Service Conductor", ta: "வெளி ஊழிய நடத்துபவர்" },
  { key: "attendant.attendant", area: "attendant", en: "Attendant", ta: "வரவேற்பாளர்" },
];

export const roleLabel = (key, lang) => {
  const r = ROLES.find((x) => x.key === key);
  return r ? r[lang] || r.en : key;
};
