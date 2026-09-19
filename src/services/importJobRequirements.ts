import type { JobRequirementsImport } from '../types'

const isJobRequirementsImport = (
  value: unknown,
): value is JobRequirementsImport => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const imported = value as Record<string, unknown>
  const requirements = imported.requirements

  if (typeof requirements !== 'object' || requirements === null) {
    return false
  }

  const jobRequirements = requirements as Record<string, unknown>
  const skills = jobRequirements.skills

  return (
    typeof imported.sourceUrl === 'string' &&
    typeof jobRequirements.role === 'string' &&
    typeof jobRequirements.seniority === 'string' &&
    typeof jobRequirements.seniorityPoints === 'number' &&
    jobRequirements.seniorityPoints >= 1 &&
    jobRequirements.seniorityPoints <= 10 &&
    Array.isArray(skills) &&
    skills.every((skill) => {
      if (typeof skill !== 'object' || skill === null) {
        return false
      }

      const requirement = skill as Record<string, unknown>
      return (
        typeof requirement.name === 'string' &&
        typeof requirement.points === 'number' &&
        requirement.points >= 1 &&
        requirement.points <= 10
      )
    })
  )
}

export async function importJobRequirements(
  endpoint: string,
  sourceUrl: string,
): Promise<JobRequirementsImport> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceUrl }),
  })

  if (!response.ok) {
    const details: unknown = await response.json().catch(() => null)
    throw new Error(
      `No se pudieron importar los requisitos (${response.status}): ${JSON.stringify(details)}`,
    )
  }

  const result: unknown = await response.json()

  if (!isJobRequirementsImport(result)) {
    throw new Error('La respuesta de importación no cumple el contrato esperado.')
  }

  return result
}