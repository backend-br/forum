import { appendFileSync, readFileSync } from 'node:fs'
import { digestBody, digestTitle, mergedCount, newJobs, newProfiles, periodEnding } from './digest.mjs'
import { githubGraphql, listIssues, recentPulls, useOctokit } from './github.mjs'

const CATEGORY_SLUG = 'geral'
const REPOSITORY = `
  query ($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      discussionCategories(first: 50) {
        nodes {
          id
          slug
        }
      }
      discussions(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          title
        }
      }
    }
  }
`
const CREATE_DISCUSSION = `
  mutation ($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
      discussion {
        url
      }
    }
  }
`

function loadTaxonomy() {
  if (!process.env.TAXONOMY_FILE) throw new Error('TAXONOMY_FILE is not set.')
  return JSON.parse(readFileSync(process.env.TAXONOMY_FILE))
}

function isDryRunOf(eventName, event) {
  if (eventName !== 'workflow_dispatch') return false
  return event.inputs['dry-run'] !== 'false' && event.inputs['dry-run'] !== false
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH))
  const isDryRun = isDryRunOf(eventName, event)
  const [owner, name] = process.env.GITHUB_REPOSITORY.split('/')
  const taxonomy = loadTaxonomy()
  const period = periodEnding(new Date())
  const since = period.start.toISOString()
  const [jobIssues, profileIssues, solutionPulls, projectPulls] = await Promise.all([
    listIssues('backend-br/vagas', { state: 'open', labels: 'verificada', since }),
    listIssues('backend-br/me-contrata', { state: 'open', labels: 'verificado,divulgar-perfil', since }),
    recentPulls('backend-br/desafios'),
    recentPulls('backend-br/opensource-br'),
  ])
  const title = digestTitle(period)
  const body = digestBody({
    period,
    jobs: newJobs(jobIssues, period, taxonomy),
    profiles: newProfiles(profileIssues, period, taxonomy),
    solutions: mergedCount(solutionPulls, period),
    projects: mergedCount(projectPulls, period),
  })
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### ${title}${isDryRun ? ' (dry run)' : ''}\n\n${body ?? 'Nothing new.'}\n`,
    )
  if (!body) return console.log('Nothing new this week.')
  const { repository } = await githubGraphql(REPOSITORY, { owner, name })
  if (repository.discussions.nodes.some((discussion) => discussion.title === title))
    return console.log(`"${title}" was already posted.`)
  const category = repository.discussionCategories.nodes.find((node) => node.slug === CATEGORY_SLUG)
  if (!category) throw new Error(`The discussion category ${CATEGORY_SLUG} does not exist.`)
  if (isDryRun) return console.log(`Dry run: "${title}" would be posted.`)
  const { createDiscussion } = await githubGraphql(CREATE_DISCUSSION, {
    repositoryId: repository.id,
    categoryId: category.id,
    title,
    body,
  })
  console.log(`Posted ${createDiscussion.discussion.url}.`)
}

export function run({ github }) {
  useOctokit(github)
  return main()
}
