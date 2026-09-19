import { useState } from 'react'
import type { JobRequirements, SkillRequirement } from '../types'

interface JobRequirementsFormProps {
  value: JobRequirements
  onChange: (value: JobRequirements) => void
}

export function JobRequirementsForm({
  value,
  onChange,
}: JobRequirementsFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillPoints, setSkillPoints] = useState('1')

  const handleRoleChange = (role: string) => {
    setSaved(false)
    onChange({ ...value, role })
  }

  const handleSkillNameChange = (name: string) => {
    setSaved(false)
    setSkillName(name)
  }

  const handleSkillPointsChange = (points: string) => {
    setSaved(false)
    setSkillPoints(points)
  }

  const handleAddSkill = () => {
    const normalizedName = skillName.trim()

    if (!normalizedName) {
      return
    }

    const newSkill: SkillRequirement = {
      name: normalizedName,
      points: Number(skillPoints),
    }

    onChange({ ...value, skills: [...value.skills, newSkill] })
    setSkillName('')
    setSkillPoints('1')
    setSaved(false)
  }

  const handleRemoveSkill = (skillIndex: number) => {
    onChange({
      ...value,
      skills: value.skills.filter((_, index) => index !== skillIndex),
    })
    setSaved(false)
  }

  const handleSeniorityChange = (seniority: string) => {
    setSaved(false)
    onChange({ ...value, seniority })
  }

  const handleSeniorityPointsChange = (points: string) => {
    setSaved(false)
    onChange({
      ...value,
      seniorityPoints: Number(points),
    })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    const isValid =
      value.role.trim().length > 0 &&
      value.skills.length > 0 &&
      value.seniority.trim().length > 0 &&
      value.seniorityPoints >= 1

    setSaved(isValid)
  }

  const isInvalid = submitted && (
    value.role.trim().length === 0 ||
    value.skills.length === 0 ||
    value.seniority.trim().length === 0 ||
    value.seniorityPoints < 1
  )

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Requerimientos del puesto</h2>

      <label htmlFor="job-role">Rol</label>
      <input
        id="job-role"
        name="role"
        type="text"
        value={value.role}
        onChange={(event) => handleRoleChange(event.target.value)}
        data-testid="job-role"
        required
      />
      {submitted && value.role.trim().length === 0 && (
        <p role="alert">Ingresá el rol del puesto.</p>
      )}

      <label htmlFor="job-skills">Tecnologías excluyentes</label>
      <input
        id="job-skills"
        name="skills"
        type="text"
        value={skillName}
        onChange={(event) => handleSkillNameChange(event.target.value)}
        data-testid="job-skills"
      />
      <label htmlFor="job-skill-points">Puntos de la habilidad</label>
      <select
        id="job-skill-points"
        name="skill-points"
        value={skillPoints}
        onChange={(event) => handleSkillPointsChange(event.target.value)}
        data-testid="job-skill-points"
      >
        {Array.from({ length: 10 }, (_, index) => index + 1).map((points) => (
          <option key={points} value={points}>
            {points}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAddSkill}
        disabled={skillName.trim().length === 0}
        data-testid="add-skill"
      >
        Agregar
      </button>
      {value.skills.length > 0 && (
        <ul data-testid="skills-list">
          {value.skills.map((skill, index) => (
            <li key={`${skill.name}-${index}`}>
              {skill.name} ({skill.points} puntos)
              <button
                type="button"
                onClick={() => handleRemoveSkill(index)}
                data-testid={`remove-skill-${index}`}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {submitted && value.skills.length === 0 && (
        <p role="alert">Agregá al menos una habilidad.</p>
      )}

      <label htmlFor="job-seniority">Años / seniority</label>
      <input
        id="job-seniority"
        name="seniority"
        type="text"
        value={value.seniority}
        onChange={(event) => handleSeniorityChange(event.target.value)}
        data-testid="job-seniority"
        required
      />
      <label htmlFor="job-seniority-points">Puntos del seniority</label>
      <select
        id="job-seniority-points"
        name="seniority-points"
        value={value.seniorityPoints}
        onChange={(event) => handleSeniorityPointsChange(event.target.value)}
        data-testid="job-seniority-points"
      >
        {Array.from({ length: 10 }, (_, index) => index + 1).map((points) => (
          <option key={points} value={points}>
            {points}
          </option>
        ))}
      </select>
      {submitted && value.seniority.trim().length === 0 && (
        <p role="alert">Ingresá los años o el seniority requerido.</p>
      )}

      <button type="submit" data-testid="job-requirements-submit">
        Guardar requerimientos
      </button>
      {isInvalid && (
        <p role="status">Completá todos los campos obligatorios.</p>
      )}
      {saved && (
        <p role="status" data-testid="requirements-saved">
          Requerimientos guardados correctamente.
        </p>
      )}
    </form>
  )
}