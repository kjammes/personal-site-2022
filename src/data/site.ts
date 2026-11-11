export const site = {
  name: 'Jayesh Karli',
  url: 'https://www.jayeshkarli.dev',
  role: 'Senior Software Engineer',
  headline:
    'Senior backend engineer. I build distributed systems that stay fast at large data volumes, and ship the full stack when a product needs it.',
  description:
    'Jayesh Karli is a senior backend engineer who builds distributed systems and data-heavy products with Spring Boot, Kafka and Elasticsearch, and ships full stack when needed.',
  email: 'jayeshkarli@gmail.com',
  /** Cal.com or similar booking link. Leave empty to hide booking buttons. */
  bookingUrl: '',
  resumeUrl: 'https://drive.google.com/file/d/1kYV7N8KsQZEhQA0yMyaZxw_1q70vowyH/view?usp=sharing',
  careerStart: '2021-06-14',
  codingStart: '2018-08-01',
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
    'Distributed systems',
    'Event-driven architecture',
    'Search at scale',
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
  { title: 'Senior Software Engineer', company: 'upGrad', start: '2025-10' },
  { title: 'Software Engineer 2', company: 'upGrad', start: '2024-10', end: '2025-10' },
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
  { group: 'platform', items: ['Microservices', 'Event-driven architecture', 'Docker', 'Kubernetes'] },
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
