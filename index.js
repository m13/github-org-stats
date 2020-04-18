const fs = require('fs');
require('dotenv').config();
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_AUTH_TOKEN
});

const b = [];

async function main() {

  const iterator = octokit.paginate.iterator(octokit.repos.listForOrg, {
    org: process.env.GITHUB_ORG_NAME,
    per_page: 100
  });

  for await (const response of iterator) {
    for await (const repo of response.data) {

      const contributors = await octokit.repos.listContributors({
        owner: process.env.GITHUB_ORG_NAME,
        repo: repo.name,
        per_page: 3
      });

      let codeowners = false;
      try {
        await octokit.repos.getContents({
          owner: process.env.GITHUB_ORG_NAME,
          repo: repo.name,
          path: '.github/CODEOWNERS',
        });
        codeowners = true;
      } catch (error) {}

      b.push({
        name: repo.name,
        default_branch: repo.default_branch,
        private: repo.private,
        archived: repo.archived,
        disabled: repo.disabled,
        size: repo.size,
        open_issues_count: repo.open_issues_count,
        watchers: repo.watchers,
        description: repo.description,
        created_at: String(repo.created_at).slice(0, 10),
        pushed_at: String(repo.pushed_at).slice(0, 10),
        user_1: contributors.data && contributors.data[0] && contributors.data[0].login,
        user_2: contributors.data && contributors.data[1] && contributors.data[1].login,
        user_3: contributors.data && contributors.data[2] && contributors.data[2].login,
        codeowners: codeowners
      });

      process.stdout.write('.');
    }
    process.stdout.write("\n");
  }

  fs.writeFileSync('./output.json', JSON.stringify(b));
}


main().catch(console.error);
