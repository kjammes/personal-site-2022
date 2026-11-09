export const site = {
  name: 'Jayesh Karli',
  url: 'https://www.jayeshkarli.dev',
  role: 'Senior Software Engineer',
  headline:
    'Senior backend engineer. I design and ship data-heavy SaaS systems, and I use AI tooling to deliver them fast without trading away reliability.',
  description:
    'Jayesh Karli is a senior backend engineer who builds scalable, data-heavy SaaS products with Spring Boot, Node.js, Kafka and Elasticsearch, using AI tooling to ship fast and reliably.',
  email: 'jayeshkarli@gmail.com',
  /** Cal.com or similar booking link. Leave empty to hide booking buttons. */
  bookingUrl: '',
  resumePath: '/JayeshKarli-Cv.pdf',
  careerStart: '2021-06-14',
  codingStart: '2018-08-01',
  leetcodeUsername: 'karli',
  socials: {
    github: 'https://github.com/kjammes',
    linkedin: 'https://www.linkedin.com/in/jayesh-karli-2b95b01a9/',
    youtube: 'https://www.youtube.com/@JKCD',
    twitter: 'https://twitter.com/JayeshKarli',
    leetcode: 'https://leetcode.com/karli/',
    instagram: 'https://www.instagram.com/jrk4real/',
  },
  knowsAbout: [
    'Spring Boot',
    'Java',
    'Kotlin',
    'Node.js',
    'TypeScript',
    'Apache Kafka',
    'Elasticsearch',
    'MySQL',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'Docker',
    'Kubernetes',
    'Microservices',
    'System design',
    'AI-assisted software engineering',
  ],
} as const;

export const nav = [
  { href: '/blog', label: 'blog' },
  { href: '/work', label: 'work' },
  { href: '/services', label: 'services' },
] as const;

export type Job = { title: string; company: string; start: string; end?: string };

/** Most recent first. */
export const experience: Job[] = [
  { title: 'Software Engineer 2', company: 'upGrad', start: '2024-10' },
  { title: 'Full Stack Developer', company: 'Whitecrow Research', start: '2023-10', end: '2024-10' },
  { title: 'Software Engineer', company: 'Neosoft Technologies', start: '2021-06', end: '2023-10' },
];

export const education = [
  { title: 'Master of Computer Applications', place: 'Chandigarh University', period: '2021 to 2023' },
  { title: 'BSc Computer Science', place: 'Mithibai College', period: '2018 to 2021' },
];

export const stack = [
  { group: 'backend', items: ['Spring Boot (Java, Kotlin)', 'Node.js, Express (TypeScript)'] },
  { group: 'data', items: ['Kafka', 'Elasticsearch', 'MySQL, Postgres', 'MongoDB', 'Redis'] },
  { group: 'platform', items: ['Docker', 'Kubernetes', 'Microservices'] },
  { group: 'frontend', items: ['TypeScript', 'React', 'Angular'] },
] as const;

export const projects = [
  {
    name: 'Digital Workspace',
    summary: 'Marketplace where freelancers find work and clients post jobs. Angular, Node.js, Express, MongoDB.',
    href: 'https://github.com/kjammes/DigitalWorkspace',
  },
  {
    name: 'DSA in Kotlin',
    summary: 'Implementations of common data structures and algorithms in Kotlin.',
    href: 'https://github.com/kjammes/DSAKotlin',
  },
  {
    name: 'MarvReviews',
    summary: 'Front end for reviews of Marvel movies and TV shows.',
    href: 'https://github.com/kjammes/MarvReviews',
  },
] as const;
