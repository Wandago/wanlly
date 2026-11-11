// Industry templates. Picking one at setup pre-fills wording, starter services and the follow-up email.

export type Industry = {
  label: string; client: string; clients: string; item: string; items: string; cta: string;
  services: [name: string, group: string, minutes: number][];
  followupDays: number; followupSubject: string; followupBody: string;
};

export const INDUSTRIES: Record<string, Industry> = {
  beauty: {
    label: "Beauty and wellness", client: "client", clients: "Clients", item: "service", items: "Services", cta: "Book now",
    services: [["Classic full set", "Lashes", 120], ["Volume full set", "Lashes", 150], ["Refill", "Lashes", 60], ["Lash lift and tint", "Lashes", 60]],
    followupDays: 14, followupSubject: "Time for your next visit to {business}?",
    followupBody: "Hi {name},\n\nIt's been two weeks since your {service}. If you'd like to keep it looking fresh, you can book your next visit here:\n{link}\n\nSee you soon,\n{business}",
  },
  health: {
    label: "Health and clinics", client: "patient", clients: "Patients", item: "appointment type", items: "Appointments", cta: "Book an appointment",
    services: [["Initial assessment", "Assessments", 45], ["Follow-up session", "Treatment", 30], ["Video consultation", "Online", 20]],
    followupDays: 7, followupSubject: "How are you getting on?",
    followupBody: "Hi {name},\n\nIt's been a week since your {service} at {business}. If you'd like a follow-up, you can book a time that suits you here:\n{link}\n\nBest wishes,\n{business}",
  },
  realestate: {
    label: "Real estate", client: "buyer", clients: "Buyers", item: "property", items: "Properties", cta: "Book a viewing",
    services: [["Property viewing", "Viewings", 30], ["Video tour", "Viewings", 30], ["Home valuation", "For sellers", 45]],
    followupDays: 1, followupSubject: "How was your viewing?",
    followupBody: "Hi {name},\n\nThanks for your {service} with {business}. We'd love to hear what you thought. Just reply to this email.\n\nIf you'd like a second look or to see something else, book here:\n{link}\n\n{business}",
  },
  fitness: {
    label: "Fitness and classes", client: "member", clients: "Members", item: "class", items: "Classes", cta: "Book a class",
    services: [["Beginner class", "Classes", 55], ["Open class", "Classes", 55], ["1:1 session", "Private", 55]],
    followupDays: 1, followupSubject: "How did it feel?",
    followupBody: "Hi {name},\n\nThanks for coming to {service} at {business}. Ready for the next one? Book here:\n{link}\n\nSee you soon,\n{business}",
  },
  other: {
    label: "Something else", client: "customer", clients: "Customers", item: "service", items: "Services", cta: "Book now",
    services: [["Appointment", "", 60], ["Consultation", "", 30]],
    followupDays: 7, followupSubject: "Thanks for visiting {business}",
    followupBody: "Hi {name},\n\nThank you for your {service} with {business}. Whenever you're ready to book again, use this link:\n{link}\n\n{business}",
  },
};
export const industryOf = (key: string) => INDUSTRIES[key] ?? INDUSTRIES.other;

export const DEFAULT_EMAILS = {
  confirmation: {
    offset: 0, subject: "You're booked with {business}",
    body: "Hi {name},\n\nYou're booked for {service} on {date} at {time}.\n\n{address}\n\n{payment}\n\nNeed to cancel or check the details? Use this link:\n{manage}\n\n{business}",
  },
  reminder: {
    offset: 24, subject: "Reminder: {service} on {date} at {time}",
    body: "Hi {name},\n\nA reminder of your {service} with {business} on {date} at {time}.\n\n{address}\n\nIf you can't make it, please cancel here so someone else can take the slot:\n{manage}\n\n{business}",
  },
};

// Suggested ways to be paid. Businesses can add any of these or write their own.
export const PAYMENT_KINDS: Record<string, { label: string; hint: string }> = {
  mpesa: { label: "M-Pesa", hint: "Till or Paybill number, and the account name" },
  mobile: { label: "Mobile money", hint: "Network and number, e.g. Airtel Money 07xx xxx xxx" },
  bank: { label: "Bank transfer", hint: "Bank, account name and account number" },
  cash: { label: "Cash", hint: "For example: pay at your appointment" },
  card: { label: "Card at the venue", hint: "For example: Visa and Mastercard accepted" },
  link: { label: "Payment link", hint: "A link to pay online, e.g. your own PayPal or Paystack page" },
  other: { label: "Other", hint: "Anything else customers should know" },
};

export const BRANDS: Record<string, { label: string; deep: string; accent: string; onAccent: string; soft: string }> = {
  ink: { label: "Ink", deep: "#18181B", accent: "#FFFFFF", onAccent: "#18181B", soft: "#F1F1F2" },
  rose: { label: "Rose", deep: "#3A0B20", accent: "#FF9CC2", onAccent: "#3A0B20", soft: "#FFE9F1" },
  teal: { label: "Teal", deep: "#0C3B3A", accent: "#7EE0CF", onAccent: "#06302E", soft: "#E3F6F2" },
  navy: { label: "Navy", deep: "#0F1E3D", accent: "#F2C75C", onAccent: "#16203A", soft: "#EEF1F8" },
  ember: { label: "Ember", deep: "#17130F", accent: "#FF7A3D", onAccent: "#1B0F08", soft: "#FCEDE4" },
  forest: { label: "Forest", deep: "#0A2B1C", accent: "#D6F53F", onAccent: "#0A2B1C", soft: "#F0FAC6" },
};
export const brandOf = (key: string) => BRANDS[key] ?? BRANDS.ink;

export const CURRENCIES = ["KES", "NGN", "ZAR", "GHS", "UGX", "TZS", "RWF", "ETB", "EGP", "MAD", "XOF", "XAF", "USD", "EUR", "GBP"];
export const TIMEZONES = ["Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Africa/Accra", "Africa/Kampala", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Addis_Ababa", "Africa/Cairo", "Africa/Casablanca", "Africa/Dakar", "Europe/London", "UTC"];
