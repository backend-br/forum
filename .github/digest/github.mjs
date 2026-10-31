const PAGE_SIZE = 100

let octokit = null

export function useOctokit(client) {
  octokit = client
}

export function listIssues(repo, filters) {
  return octokit.paginate(`GET /repos/${repo}/issues`, { per_page: PAGE_SIZE, ...filters })
}

export async function recentPulls(repo) {
  const { data } = await octokit.request(`GET /repos/${repo}/pulls`, {
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
    per_page: PAGE_SIZE,
  })
  return data
}

export function githubGraphql(query, variables) {
  return octokit.graphql(query, variables)
}
