export const PRIMARY_NAV = [
  { href: "/esims", label: "Travel eSIMs" },
  { href: "/verification", label: "Verification numbers" },
  { href: "/numbers/rentals", label: "Number rentals" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/help", label: "Help & support" },
] as const;

export const FOOTER_NAV = [
  {
    title: "Products",
    links: [
      { href: "/esims", label: "Travel eSIMs" },
      { href: "/verification", label: "SMS verification numbers" },
      { href: "/numbers/rentals", label: "Long term number rentals" },
      { href: "/device-compatibility", label: "Device compatibility" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/help", label: "Help centre" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/orders", label: "Orders" },
      { href: "/dashboard/support", label: "Support tickets" },
      { href: "/register", label: "Create account" },
    ],
  },
] as const;

export const LEGAL_NAV = [
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/acceptable-use", label: "Acceptable use" },
] as const;
