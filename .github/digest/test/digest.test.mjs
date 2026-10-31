import assert from 'node:assert/strict'
import { test } from 'node:test'
import { digestBody, digestTitle, mergedCount, newJobs, newProfiles, periodEnding, plainText } from '../digest.mjs'
import { taxonomy } from './taxonomy.fixture.mjs'

const period = periodEnding(new Date('2026-11-02T12:00:00Z'))

function issue(number, createdAt, title, labels = []) {
  return { number, created_at: createdAt, title, labels: labels.map((name) => ({ name })) }
}

test('the week ends at the run and the title uses the Brazilian dates', () => {
  assert.equal(period.start.toISOString(), '2026-10-26T12:00:00.000Z')
  assert.equal(digestTitle(period), 'Resumo da semana: 26/10 a 02/11/2026')
})

test('text from issues never mentions people nor references issues', () => {
  assert.equal(plainText('Vaga @empresa #123 [x](y) *Go*'), 'Vaga empresa 123 \\[x\\](y) Go')
})

test('only jobs opened inside the week enter, with level and work model', () => {
  const jobs = newJobs(
    [
      issue(12, '2026-10-27T10:00:00Z', '[Remoto] Back-end Go', ['Pleno', 'PJ', 'Remoto', 'Go', 'verificada']),
      issue(10, '2026-10-20T10:00:00Z', 'Antiga', ['Sênior']),
      { ...issue(13, '2026-10-28T10:00:00Z', 'PR'), pull_request: {} },
    ],
    period,
    taxonomy,
  )

  assert.deepEqual(jobs, [
    { title: '\\[Remoto\\] Back-end Go', url: 'https://backend-br.github.io/vagas/12/', details: ['Pleno', 'Remoto'] },
  ])
})

test('profiles link to the site and show the level and up to five stacks', () => {
  const [profile] = newProfiles(
    [issue(7, '2026-10-30T10:00:00Z', 'Maria - Back-end', ['Sênior', 'Go', 'Java', 'PostgreSQL'])],
    period,
    taxonomy,
  )

  assert.equal(profile.url, 'https://backend-br.github.io/talentos/#perfil-7')
  assert.deepEqual(profile.details, ['Sênior', 'Go, Java, PostgreSQL'])
})

test('counts the pull requests merged inside the week', () => {
  const pulls = [{ merged_at: '2026-10-27T10:00:00Z' }, { merged_at: null }, { merged_at: '2026-10-01T10:00:00Z' }]

  assert.equal(mergedCount(pulls, period), 1)
})

test('a quiet week has no digest', () => {
  assert.equal(digestBody({ period, jobs: [], profiles: [], solutions: 0, projects: 0 }), null)
})

test('the digest lists the sections that have news and caps long lists', () => {
  const jobs = Array.from({ length: 32 }, (_, index) => ({ title: `Vaga ${index}`, url: `u${index}`, details: [] }))

  const body = digestBody({ period, jobs, profiles: [], solutions: 2, projects: 0 })

  assert.match(body, /## Vagas verificadas \(32\)/)
  assert.match(body, /- E mais 2 em \[backend-br\.github\.io\/vagas\/\]/)
  assert.match(body, /2 soluções novas foram aceitas/)
  assert.doesNotMatch(body, /Perfis novos|Projetos open source/)
})
