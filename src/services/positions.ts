import type { JobRequirements } from '../types'
import { supabaseClient } from './supabaseClient'

export type PositionStatus = 'Nueva' | 'Abierta' | 'Cubierta' | 'Cancelada'

export interface SavedPosition {
  id: string
  title: string
  requirements: JobRequirements
  status: PositionStatus
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Supabase devolvió un puesto con formato inválido.')
  }

  return value as Record<string, unknown>
}

const isPositionStatus = (value: unknown): value is PositionStatus =>
  value === 'Nueva' ||
  value === 'Abierta' ||
  value === 'Cubierta' ||
  value === 'Cancelada'

const parsePosition = (value: unknown): SavedPosition => {
  const row = asRecord(value)
  const skillsValue = row.position_skills

  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.seniority !== 'string' ||
    typeof row.seniority_points !== 'number' ||
    !isPositionStatus(row.status) ||
    !Array.isArray(skillsValue)
  ) {
    throw new Error('Supabase devolvió un puesto con formato inválido.')
  }

  const skills = skillsValue.map((skillValue) => {
    const skill = asRecord(skillValue)
    if (
      typeof skill.name !== 'string' ||
      typeof skill.points !== 'number'
    ) {
      throw new Error(
        'Supabase devolvió una ponderación de habilidad con formato inválido.',
      )
    }

    return { name: skill.name, points: skill.points }
  })

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    requirements: {
      role: row.title,
      seniority: row.seniority,
      seniorityPoints: row.seniority_points,
      skills,
    },
  }
}

export const listSavedPositions = async (
  recruiterId: string,
): Promise<SavedPosition[]> => {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  const { data, error } = await supabaseClient
    .from('positions')
    .select(
      'id, title, seniority, seniority_points, status, position_skills(name, points)',
    )
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar los puestos: ${error.message}`)
  }

  if (!Array.isArray(data)) {
    throw new Error('Supabase devolvió una lista de puestos inválida.')
  }

  return data.map(parsePosition)
}

export const savePosition = async ({
  positionId,
  requirements,
}: {
  positionId: string | null
  requirements: JobRequirements
}): Promise<string> => {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  const { data, error } = await supabaseClient.rpc('save_position', {
    p_position_id: positionId,
    p_title: requirements.role.trim(),
    p_seniority: requirements.seniority,
    p_seniority_points: requirements.seniorityPoints,
    p_skills: requirements.skills.map(({ name, points }) => ({
      name,
      points,
    })),
  })

  if (error) {
    throw new Error(`No se pudo guardar el puesto: ${error.message}`)
  }

  if (typeof data !== 'string' || !data) {
    throw new Error('Supabase no devolvió el identificador del puesto guardado.')
  }

  return data
}
