// ============================================================================
// i18n — UI label dictionary (English / Tamil). Publisher names are stored
// as typed (Tamil), independent of UI language.
// ============================================================================
const DICT = {
  en: {
    app: "Schedule", tagline: "Congregation scheduling",
    dashboard: "Dashboard", clm: "Midweek Meeting", weekend: "Weekend Meeting",
    av: "Audio / Video", cleaning: "Cleaning", fsm: "Field Service", attendant: "Attendants",
    publishers: "Publishers", groups: "Groups", access: "Members & Access", settings: "Settings",
    schedules: "Schedules", people: "People", admin: "Admin",
    signIn: "Sign in", email: "Email", continue: "Continue", signOut: "Sign out",
    createCong: "Create congregation", congName: "Congregation name", create: "Create",
    noCong: "No congregations yet", noCongHint: "Create one to get started, or ask an owner to add your email.",
    add: "Add", edit: "Edit", save: "Save", cancel: "Cancel", delete: "Delete", close: "Close",
    exportPdf: "Export PDF", print: "Print", search: "Search",
    name: "Name", nameEn: "Name (English)", gender: "Gender", brother: "Brother", sister: "Sister", group: "Group", roles: "Roles",
    active: "Active", inactive: "Inactive", assignee: "Assignee", assistant: "Assistant", reader: "Reader",
    portions: "Student Portions", baptized: "Baptized", exempt: "Exempt", helper: "Helper", images: "Images",
    all: "All", studentsOnly: "Students only", unbaptised: "Unbaptised", includeInactive: "Include inactive", count: "Count",
    chairman: "Chairman", prayer: "Prayer", date: "Date", none: "—", unassigned: "Unassigned",
    thisWeek: "This week", nextWeek: "Next week", gaps: "Open assignments", conflicts: "Conflicts", fairness: "Workload",
    history: "Assignment history", partners: "Partners", lastAssigned: "Last assigned", never: "Never",
    saving: "Saving…", saved: "Saved", offline: "Offline", online: "Online",
    addWeek: "Add week", duplicate: "Duplicate last", localNeeds: "Local Needs",
    viewOnly: "View only", grant: "Add member", revoke: "Remove", permissions: "Permissions",
    view: "View", editPerm: "Edit", owner: "Owner", assignNext: "Assign to next open slot",
    confirmDelete: "Delete this? This cannot be undone.", required: "Required",
    minutes: "min", theme: "Theme", language: "Language", backup: "Backup / restore",
  },
  ta: {
    app: "அட்டவணை", tagline: "சபை அட்டவணை",
    dashboard: "முகப்பு", clm: "வார நடு கூட்டம்", weekend: "வார இறுதி கூட்டம்",
    av: "ஒலி / ஒளி", cleaning: "சுத்தம்", fsm: "வெளி ஊழியம்", attendant: "வரவேற்பாளர்கள்",
    publishers: "பிரஸ்தாபிகள்", groups: "குழுக்கள்", access: "உறுப்பினர்கள்", settings: "அமைப்புகள்",
    schedules: "அட்டவணைகள்", people: "நபர்கள்", admin: "நிர்வாகம்",
    signIn: "உள்நுழை", email: "மின்னஞ்சல்", continue: "தொடரவும்", signOut: "வெளியேறு",
    createCong: "சபையை உருவாக்கு", congName: "சபையின் பெயர்", create: "உருவாக்கு",
    noCong: "சபைகள் இல்லை", noCongHint: "தொடங்க ஒன்றை உருவாக்கவும், அல்லது உரிமையாளரிடம் அணுகல் கேளுங்கள்.",
    add: "சேர்", edit: "திருத்து", save: "சேமி", cancel: "ரத்து", delete: "நீக்கு", close: "மூடு",
    exportPdf: "PDF ஏற்றுமதி", print: "அச்சிடு", search: "தேடு",
    name: "பெயர்", nameEn: "பெயர் (ஆங்கிலம்)", gender: "பாலினம்", brother: "சகோதரர்", sister: "சகோதரி", group: "குழு", roles: "பொறுப்புகள்",
    active: "செயலில்", inactive: "செயலற்ற", assignee: "பொறுப்பாளர்", assistant: "உதவியாளர்", reader: "வாசிப்பாளர்",
    portions: "பயிற்சி பகுதிகள்", baptized: "ஞானஸ்நானம் பெற்றவர்", exempt: "விதிவிலக்கு", helper: "உதவி", images: "படங்கள்",
    all: "அனைவரும்", studentsOnly: "மாணவர்கள் மட்டும்", unbaptised: "ஞானஸ்நானம் பெறாதவர்", includeInactive: "செயலற்றோரையும்", count: "எண்ணிக்கை",
    chairman: "சேர்மன்", prayer: "ஜெபம்", date: "தேதி", none: "—", unassigned: "நியமிக்கப்படவில்லை",
    thisWeek: "இந்த வாரம்", nextWeek: "அடுத்த வாரம்", gaps: "நிரப்பப்படாதவை", conflicts: "முரண்பாடுகள்", fairness: "பணிச்சுமை",
    history: "பணி வரலாறு", partners: "இணைந்தவர்கள்", lastAssigned: "கடைசி நியமனம்", never: "இல்லை",
    saving: "சேமிக்கிறது…", saved: "சேமித்தது", offline: "ஆஃப்லைன்", online: "ஆன்லைன்",
    addWeek: "வாரம் சேர்", duplicate: "நகல் எடு", localNeeds: "சபைத் தேவைகள்",
    viewOnly: "பார்வை மட்டும்", grant: "உறுப்பினர் சேர்", revoke: "நீக்கு", permissions: "அனுமதிகள்",
    view: "பார்வை", editPerm: "திருத்து", owner: "உரிமையாளர்", assignNext: "அடுத்த இடத்தில் நியமி",
    confirmDelete: "நீக்கவா? மீட்டெடுக்க முடியாது.", required: "தேவை",
    minutes: "நிமி", theme: "தீம்", language: "மொழி", backup: "காப்பு / மீட்பு",
  },
};

let lang = localStorage.getItem("jw_lang") || "ta";
export const getLang = () => lang;
export const setLang = (l) => { lang = l; localStorage.setItem("jw_lang", l); };
export const t = (key) => (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
// Always-English accessor — used by the login / onboarding screens.
export const en = (key) => DICT.en[key] || key;
