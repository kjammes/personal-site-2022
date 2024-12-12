const jobStartDate = new Date('2021-06-14');
const currentDate = new Date();

const totalMonths = 
  (currentDate.getFullYear() - jobStartDate.getFullYear()) * 12 +
  (currentDate.getMonth() - jobStartDate.getMonth());

const years = Math.floor(totalMonths / 12);
const months = totalMonths % 12;

const experienceText = `${years}yr${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} months` : ''}`;

document.querySelector('.home__description').textContent = 
  `I have over ${experienceText} of professional experience in solving problems through code.`;

document.querySelector('meta[name="description"]').setAttribute(
  'content',
  `Hi, I'm Jayesh Professional Software Engineer. I have over ${experienceText} of professional experience in solving problems through code. Spring Boot (Java), NodeJS & ExpressJS, ElasticSearch, MySQL, Kafka and MongoDB are some of the tools helping me build efficient software experiences.`
);
