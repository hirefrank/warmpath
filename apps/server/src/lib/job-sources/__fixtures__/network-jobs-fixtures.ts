export const fixtureManifest = {
  categories: {
    product: { file: "product.json" },
    engineering: { file: "engineering.json" },
  },
};

export const fixtureProductJobs = [
  {
    id: 101,
    title: "Senior Product Manager",
    company: "Acme",
    companyDomain: "acme.com",
    category: "product",
    location: "Remote",
    url: "https://acme.com/jobs/101",
    salary: { min: 180000, max: 220000 },
    postedAt: "2026-02-20T00:00:00Z",
    firstSeen: "2026-02-21T00:00:00Z",
    lastSeen: "2026-02-26T00:00:00Z",
  },
  {
    id: 102,
    title: "Product Ops Lead",
    company: "Bravo",
    companyDomain: "bravo.com",
    category: "product",
    location: "NYC",
    url: "https://bravo.com/jobs/102",
    postedAt: "2026-02-19T00:00:00Z",
    firstSeen: "2026-02-21T00:00:00Z",
    lastSeen: "2026-02-26T00:00:00Z",
  },
];

export const fixtureProductNycSeniorJobs = [
  {
    id: 102,
    title: "Product Ops Lead",
    company: "Bravo",
    companyDomain: "bravo.com",
    category: "product",
    location: "NYC",
    url: "https://bravo.com/jobs/102",
    postedAt: "2026-02-19T00:00:00Z",
    firstSeen: "2026-02-21T00:00:00Z",
    lastSeen: "2026-02-26T00:00:00Z",
  },
  {
    id: 103,
    title: "Senior Group Product Manager",
    company: "Acme",
    companyDomain: "acme.com",
    category: "product",
    location: "NYC",
    url: "https://acme.com/jobs/103",
    postedAt: "2026-02-18T00:00:00Z",
    firstSeen: "2026-02-21T00:00:00Z",
    lastSeen: "2026-02-26T00:00:00Z",
  },
];

export const fixtureEngineeringJobs = [
  {
    id: 201,
    title: "Staff Software Engineer",
    company: "Acme",
    companyDomain: "acme.com",
    category: "engineering",
    location: "SF",
    url: "https://acme.com/jobs/201",
    postedAt: "2026-02-15T00:00:00Z",
    firstSeen: "2026-02-20T00:00:00Z",
    lastSeen: "2026-02-26T00:00:00Z",
  },
];
