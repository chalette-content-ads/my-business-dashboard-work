// Site settings for a published copy, read from environment variables. In a student's own
// repository they are GitHub repository variables (Settings → Secrets and variables →
// Actions → Variables), which .github/workflows/publish-site.yml passes to the build:
//
//   BUSINESS_NAME  the business name shown at the top of the dashboard, e.g. 小明家具店
//                  (without it, the name of the opened Excel file is shown)
//
// Optional. A mistake stops the build with a message the student can act on, so a wrong
// value never reaches the site. The value is built into the page, which is public: it is
// a setting, never a secret.

export const BUSINESS_NAME_MAX = 40;

// A Google API key ("AIza…") or any long letters-and-digits token. Variables are built into
// the public page, so a key there would be published to everyone.
export const looksLikeSecret = v => /AIza[0-9A-Za-z_-]{20,}/.test(v) || (/^[A-Za-z0-9_.-]{30,}$/.test(v) && /\d/.test(v) && /[A-Za-z]/.test(v));

export function siteConfigFromEnv(env = process.env) {
  const problems = [];
  const businessName = String(env.BUSINESS_NAME ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (looksLikeSecret(businessName)) {
    problems.push('BUSINESS_NAME 看起来像 API 钥匙。钥匙绝对不能放在仓库变量里：变量会写进公开的网站。请立刻删除这个变量，到 AI Studio 删掉这把钥匙、换一把新的，只贴在你网站的「用 Gemini 分析」里。· BUSINESS_NAME looks like an API key. Keys must never be repository variables: variables are built into the public site. Delete the variable now, delete that key in AI Studio and make a new one, and paste it only into "Analyse with Gemini" on your site.');
  }
  const length = [...businessName].length;
  if (length > BUSINESS_NAME_MAX) {
    problems.push(`BUSINESS_NAME 太长了：最多 ${BUSINESS_NAME_MAX} 个字，现在是 ${length} 个。· BUSINESS_NAME is too long: at most ${BUSINESS_NAME_MAX} characters, now ${length}.`);
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return { businessName };
}

// The replacement for src/site-config.js in the build and in npm run dev.
export function siteConfigModule(config) {
  return `export const SITE_CONFIG = Object.freeze(${JSON.stringify(config)});\n`;
}

export function describeSiteConfig({ businessName }) {
  return `Site settings: BUSINESS_NAME=${businessName ? JSON.stringify(businessName) : '(not set)'}`;
}
