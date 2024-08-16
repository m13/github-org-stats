//
// Number of requests
// 30 teams * 5 calls ~= 1600 requests of 5000 / rate-limit hour
//

const fs = require('fs');
require('dotenv').config();
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: process.env.GITHUB_AUTH_TOKEN
});

async function getMembers(team) {
  const response = await octokit.rest.teams.listMembersInOrg({
    org: process.env.GITHUB_ORG_NAME,
    team_slug: team.slug,
    per_page: 100
  });

  return response.data;
}

async function getRepositories(team) {
  const response = await octokit.rest.teams.listReposInOrg({
    org: process.env.GITHUB_ORG_NAME,
    team_slug: team.slug,
    per_page: 100
  });

  return response.data;
}


const bufferWithAllEntries = [];

async function main() {

  const iterator = octokit.paginate.iterator(octokit.rest.teams.list, {
    org: process.env.GITHUB_ORG_NAME,
    per_page: 100
  });

  for await (const response of iterator) {
    for await (const team of response.data) {
      // if (team.slug !== 'engineering') continue;
      process.stdout.write(`${team.slug} `);

      const members = await getMembers(team);
      const repos = await getRepositories(team);

      bufferWithAllEntries.push({
        parent: (team.parent) ? team.parent.slug : '',
        id: team.slug,
        members_count: members.length,
        members: members.map((row) => row.login).join(' '),
        repos_count: repos.length,
        repos: repos.map((row) => row.name).join(' '),
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
