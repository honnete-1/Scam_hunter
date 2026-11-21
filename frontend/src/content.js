// Text and asset settings that are likely to change, kept in one place.

// Media slots. Drop the files into frontend/public at these paths; until then a fallback is shown.
export const media = {
  problemImage: "/images/rwanda-phone-context.jpg",
  problemImageAlt: "A person in Rwanda reading a message on their phone",
  demoVideo: "/media/scam-hunter-demo.mp4",
  demoPoster: "/images/scam-hunter-demo-poster.jpg",
};

// Only add verified figures with a source. Entries without a value and source are not shown.
export const rwandaStats = [
  { key: "rwandaScamStat1", value: "", label: "", source: "", sourceUrl: "" },
  { key: "rwandaScamStat2", value: "", label: "", source: "", sourceUrl: "" },
  { key: "rwandaScamStat3", value: "", label: "", source: "", sourceUrl: "" },
];

// Friendly names for the indicator types the backend rule engine returns.
export const indicatorLabels = {
  urgency: "Urgent language",
  sensitive_information_request: "Asks for private information",
  payment_request: "Payment request",
  impersonation: "Claims to be an organisation",
  reward_claim: "Prize or reward claim",
  emotional_pressure: "Emotional pressure or threats",
  ip_address_host: "Uses an IP address instead of a name",
  credentials_in_url: "Hidden destination (@ in the link)",
  punycode_domain: "Look-alike characters in the name",
  url_shortener: "Shortened link",
  excessive_subdomains: "Unusually long website name",
  suspicious_domain_word: "Official-sounding word in the name",
  very_long_url: "Unusually long link",
  ai_assessment: "AI second opinion",
  known_malicious_link: "Link listed as harmful",
  new_domain: "Very new website",
  similar_to_reported: "Matches confirmed community reports",
};

export const subjectNames = { MESSAGE: "message", URL: "link", PHONE: "phone number" };

// Real results from "python manage.py evaluate_detector" (rules only) and "... --online" (rules + AI).
// Update these numbers after each new evaluation run.
export const evaluationResults = {
  measuredOn: "21 Nov 2026",
  sets: [
    { name: "Main", size: "30 scam + 30 normal messages", rules: { detected: 100, falseAlarms: 0 }, withAI: { detected: 100, falseAlarms: 0 } },
    { name: "Holdout", size: "15 + 15", rules: { detected: 100, falseAlarms: 0 }, withAI: { detected: 100, falseAlarms: 0 } },
    { name: "Challenge (unseen)", size: "20 + 20", rules: { detected: 60, falseAlarms: 5 }, withAI: { detected: 95, falseAlarms: 10 } },
  ],
};

// Mobile app links. Set them in frontend/.env.local (see README); a link is only shown once it is set.
export const mobileApp = {
  apkUrl: import.meta.env.VITE_ANDROID_APK_URL || "",
  expoGoUrl: import.meta.env.VITE_EXPO_GO_URL || "",
};
