//
// Number of requests
// 320 repos * 5 calls ~= 1600 requests of 5000 / rate-limit hour
//

const fs = require('fs');
require('dotenv').config();
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_AUTH_TOKEN
});

async function getLast3Contributors(repo) {
  const contributors = await octokit.rest.repos.listContributors({
    owner: process.env.GITHUB_ORG_NAME,
    repo: repo.name,
    per_page: 3
  });
  return {
    first: contributors.data && contributors.data[0] && contributors.data[0].login,
    second: contributors.data && contributors.data[1] && contributors.data[1].login,
    third: contributors.data && contributors.data[2] && contributors.data[2].login
  };
}

async function getCodeOwnerFile(repo) {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: process.env.GITHUB_ORG_NAME,
      repo: repo.name,
      path: '.github/CODEOWNERS',
    });
    if (response.data.size > 0) {
      return Buffer.from(response.data.content, 'base64').toString();
    }
  } catch (error) {}
  return '';
}

async function getDependabotInfo(repo) {
  const statuses = {
    open: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    fixed: 0,
    total: 0
  };

  if (repo.archived || repo.security_and_analysis.dependabot_security_updates.status === 'disabled') return statuses;

  const response = await octokit.rest.dependabot.listAlertsForRepo({
    owner: process.env.GITHUB_ORG_NAME,
    repo: repo.name,
    per_page: 100
  });
  statuses.total = response.data.length;

  for (const bug of response.data) {
    if (bug.state === 'open') {
      statuses.open[bug.security_vulnerability.severity] += 1;
    } else {
      statuses.fixed += 1;
    }
  }
  return statuses;
}

async function getBranchProtection(repo) {
  let response = null;
  try {
    response = await octokit.rest.repos.getBranchProtection({
      owner: process.env.GITHUB_ORG_NAME,
      repo: repo.name,
      branch: repo.default_branch,
    });
  } catch (error) {}

  return {
    br_pr_enabled: !!(response && response.data.required_pull_request_reviews),
    br_pr_approver_count: (response && response.data.required_pull_request_reviews) ? response.data.required_pull_request_reviews.required_approving_review_count : 0,
    br_pr_dissmiss_state: (response && response.data.required_pull_request_reviews) ? response.data.required_pull_request_reviews.dismiss_stale_reviews : false,
    br_pr_code_owner: (response && response.data.required_pull_request_reviews) ? response.data.required_pull_request_reviews.require_code_owner_reviews : false,
    br_pr_last_push: (response && response.data.required_pull_request_reviews) ? response.data.required_pull_request_reviews.require_last_push_approval : false,

    br_status_enabled: !!(response && response.data.required_status_checks),
    br_status_strict: (response && response.data.required_status_checks) ? response.data.required_status_checks.strict : false,
    br_status_contexts: (response && response.data.required_status_checks) ? JSON.stringify(response.data.required_status_checks.contexts) : '',
    br_status_checks_count: (response && response.data.required_status_checks) ? response.data.required_status_checks.checks.length : 0,

    br_required_signatures: (response) ? response.data.required_signatures.enabled : false,
    br_enforce_admins: (response) ? response.data.enforce_admins.enabled : false,
    br_required_linear_history: (response) ? response.data.required_linear_history.enabled : false,
    br_allow_force_pushes: (response) ? response.data.allow_force_pushes.enabled : false,
    br_allow_deletions: (response) ? response.data.allow_deletions.enabled : false,
    br_block_creations: (response) ? response.data.block_creations.enabled : false,
    br_required_conversation_resolution: (response) ? response.data.required_conversation_resolution.enabled : false,
    br_lock_branch: (response) ? response.data.lock_branch.enabled : false,
    br_allow_fork_syncing: (response) ? response.data.allow_fork_syncing.enabled : false,
  };
}

async function getTeams(repo) {
  const accesses = {
    admin: [],
    maintain: [],
    push: [],
    triage: [],
    pull: []
  };

  const response = await octokit.rest.repos.listTeams({
    owner: process.env.GITHUB_ORG_NAME,
    repo: repo.name,
    per_page: 100
  });

  for (const team of response.data) {
    accesses[team.permission].push(team.slug);
  }

  return {
    team_admin: accesses.admin.join(' '),
    team_maintain: accesses.maintain.join(' '),
    team_push: accesses.push.join(' '),
    team_triage: accesses.triage.join(' '),
    team_pull: accesses.pull.join(' '),
  };
}


const bufferWithAllEntries = [];

async function main() {

  const iterator = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
    org: process.env.GITHUB_ORG_NAME,
    per_page: 100,
    type: 'all'
  });

  for await (const response of iterator) {
    for await (const repo of response.data) {
      process.stdout.write(`${repo.name} `);

      const contributors = await getLast3Contributors(repo);
      const codeOwnerContent = await getCodeOwnerFile(repo);
      const dependabot = await getDependabotInfo(repo);
      const branch = await getBranchProtection(repo);
      const teams = await getTeams(repo);

      bufferWithAllEntries.push({
        name: repo.name,
        url: `=HYPERLINK("https://github.com/${process.env.GITHUB_ORG_NAME}/" & A${bufferWithAllEntries.length + 2}, "url")`,
        private: repo.private,
        archived: repo.archived,
        disabled: repo.disabled,
        description: repo.description,
        size: repo.size,
        open_issues_count: repo.open_issues_count,
        watchers_count: repo.watchers_count,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        license: repo.license && repo.license.key,
        allow_forking: repo.allow_forking,
        web_commit_signoff_required: repo.web_commit_signoff_required,
        has_issues: repo.has_issues,
        has_projects: repo.has_projects,
        has_downloads: repo.has_downloads,
        has_wiki: repo.has_wiki,
        has_pages: repo.has_pages,
        has_discussions: repo.has_discussions,
        created_at: String(repo.created_at).slice(0, 10),
        pushed_at: String(repo.pushed_at).slice(0, 10),
        // security?
        secret_scanning: repo.security_and_analysis.secret_scanning.status === 'enabled',
        secret_scanning_push_protection: repo.security_and_analysis.secret_scanning_push_protection.status === 'enabled',
        dependabot_security_updates: repo.security_and_analysis.dependabot_security_updates.status === 'enabled',
        secret_scanning_non_provider_patterns: repo.security_and_analysis.secret_scanning_non_provider_patterns.status === 'enabled',
        secret_scanning_validity_checks: repo.security_and_analysis.secret_scanning_validity_checks.status === 'enabled',
        // contributors
        user_1: contributors.first,
        user_2: contributors.second,
        user_3: contributors.third,
        // codeowner
        codeowners: codeOwnerContent,
        // dependabot
        depbot_total: dependabot.total,
        depbot_fixed: dependabot.fixed,
        depbot_open_critical: dependabot.open.critical,
        depbot_open_high: dependabot.open.high,
        depbot_open_medium: dependabot.open.medium,
        depbot_open_low: dependabot.open.low,
        // branch protection
        default_branch: repo.default_branch,
        ...branch,
        // access control
        ...teams
      });

      // console.log(bufferWithAllEntries[0]);
      // process.exit(0);
    }
    process.stdout.write("\n");
  }

  fs.writeFileSync('./output.json', JSON.stringify(bufferWithAllEntries));
  console.log(`\nNow you can run: \n\n\tjson2csv -i output.json -o output.csv\n\n`);
}


main().catch(console.error);
