const SITE = 'https://backend-br.github.io'
const TIME_ZONE = 'America/Sao_Paulo'
const MAX_ITEMS = 30
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export function periodEnding(end) {
  return { start: new Date(end.getTime() - MILLISECONDS_PER_WEEK), end }
}

function day(date, withYear) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: TIME_ZONE,
  }).format(date)
}

export function digestTitle({ start, end }) {
  return `Resumo da semana: ${day(start, false)} a ${day(end, true)}`
}

export function plainText(text) {
  return (text ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[@<>*_`|\\]/g, '')
    .replace(/#(?=\d)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[[\]]/g, '\\$&')
}

function isInside(instant, { start, end }) {
  const time = new Date(instant).getTime()
  return time >= start.getTime() && time < end.getTime()
}

function namesIn(labels, names) {
  const labelNames = labels.map((label) => label.name)
  return names.filter((name) => labelNames.includes(name))
}

function facetNames(taxonomy, facet) {
  return taxonomy[facet].map((entry) => entry.name)
}

export function newJobs(issues, period, taxonomy) {
  return issues
    .filter((issue) => !issue.pull_request && isInside(issue.created_at, period))
    .sort((a, b) => a.number - b.number)
    .map((issue) => ({
      title: plainText(issue.title),
      url: `${SITE}/vagas/${issue.number}/`,
      details: [
        ...namesIn(issue.labels, facetNames(taxonomy, 'levels')),
        ...namesIn(issue.labels, facetNames(taxonomy, 'workModels')),
      ],
    }))
}

export function newProfiles(issues, period, taxonomy) {
  return issues
    .filter((issue) => !issue.pull_request && isInside(issue.created_at, period))
    .sort((a, b) => a.number - b.number)
    .map((issue) => ({
      title: plainText(issue.title),
      url: `${SITE}/talentos/#perfil-${issue.number}`,
      details: [
        ...namesIn(issue.labels, facetNames(taxonomy, 'levels')),
        namesIn(issue.labels, facetNames(taxonomy, 'stacks')).slice(0, 5).join(', '),
      ].filter(Boolean),
    }))
}

export function mergedCount(pulls, period) {
  return pulls.filter((pull) => pull.merged_at && isInside(pull.merged_at, period)).length
}

function mergedUrl(repo, { start }) {
  const since = start.toISOString().slice(0, 10)
  return `https://github.com/${repo}/pulls?q=${encodeURIComponent(`is:pr is:merged merged:>=${since}`)}`
}

function listSection(title, items, moreUrl) {
  const lines = [`## ${title} (${items.length})`, '']
  for (const item of items.slice(0, MAX_ITEMS)) {
    lines.push(`- [${item.title}](${item.url})${item.details.length ? ` · ${item.details.join(' · ')}` : ''}`)
  }
  if (items.length > MAX_ITEMS)
    lines.push(`- E mais ${items.length - MAX_ITEMS} em [${moreUrl.replace('https://', '')}](${moreUrl}).`)
  return lines.join('\n')
}

export function digestBody({ period, jobs, profiles, solutions, projects }) {
  const sections = []
  if (jobs.length) sections.push(listSection('Vagas verificadas', jobs, `${SITE}/vagas/`))
  if (profiles.length) sections.push(listSection('Perfis novos', profiles, `${SITE}/talentos/`))
  if (solutions)
    sections.push(
      `## Desafios\n\n${solutions === 1 ? '1 solução nova foi aceita' : `${solutions} soluções novas foram aceitas`} em [backend-br/desafios](${mergedUrl('backend-br/desafios', period)}).`,
    )
  if (projects)
    sections.push(
      `## Projetos open source\n\n${projects === 1 ? '1 contribuição foi aceita' : `${projects} contribuições foram aceitas`} em [backend-br/opensource-br](${mergedUrl('backend-br/opensource-br', period)}).`,
    )
  if (!sections.length) return null
  return [
    `Resumo automático do que entrou na comunidade de ${day(period.start, true)} a ${day(period.end, true)}.`,
    ...sections,
    `Acompanhe as vagas por [RSS](${SITE}/vagas.xml) ou em [JSON](${SITE}/vagas.json), e os perfis em [JSON](${SITE}/talentos.json).`,
  ].join('\n\n')
}
