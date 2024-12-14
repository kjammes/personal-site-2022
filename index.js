/**
 * 
 * @param {Date} startDate 
 * @returns
 */
async function calculateExperienceFrom(startDate) {
  const currentDate = new Date();

  const totalMonths =
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth());

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  return { years, months }
}

const LEETCODE_USERNAME = "karli";
const YOUTUBE_CHANNEL_ID = "your-youtube-channel-id";
const LINKEDIN_PROFILE_URL = "your-linkedin-profile-url";

/**
 * 
 * @param {string} username 
 * @returns
 */
async function fetchLeetCodeStats(username) {
  try {
    const response = await fetch(`https://leetcode-stats-api.herokuapp.com/${username}`);
    if (response.ok) {
      const data = await response.json();
      return data.totalSolved || 0;
    }
    throw new Error("Failed to fetch LeetCode stats");
  } catch (error) {
    console.error(error);
    return 0;
  }
}

async function displayStats() {
  const professionalExperience = await calculateExperienceFrom(new Date('2021-06-14'));
  const professionalExperienceText = `${professionalExperience.years}yr${professionalExperience.years !== 1 ? 's' : ''}${professionalExperience.months > 0 ? ` ${professionalExperience.months} months` : ''}`;  
  document.querySelector('.home__description').textContent =
    `I have over ${professionalExperienceText} of professional experience in solving problems through code.`;
  document.querySelector('meta[name="description"]').setAttribute(
    'content',
    `Hi, I'm Jayesh Professional Software Engineer. I have over ${professionalExperienceText} of professional experience in solving problems through code. Spring Boot (Java), NodeJS & ExpressJS, ElasticSearch, MySQL, Kafka and MongoDB are some of the tools helping me build efficient software experiences.`
  );

  const codingExperience = await calculateExperienceFrom(new Date('2018-08-01'));
  document.getElementById('total_development_experience').textContent = `${codingExperience.years < 10 ? '0' + codingExperience.years : codingExperience.years}+`;
  document.getElementById('professional_development_experience').textContent = `${professionalExperience.years < 10 ? '0' + professionalExperience.years : professionalExperience.years}+`;
  
  const leetCodeSolved = await fetchLeetCodeStats(LEETCODE_USERNAME);
  document.getElementById('leetcode_problems_solved').textContent = leetCodeSolved;
}

displayStats();
