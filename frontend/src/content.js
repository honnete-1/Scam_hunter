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
};

export const subjectNames = { MESSAGE: "message", URL: "link", PHONE: "phone number" };
