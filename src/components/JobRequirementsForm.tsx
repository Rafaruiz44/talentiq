import { useState } from 'react'
import type { JobRequirements, SkillRequirement } from '../types'

interface JobRequirementsFormProps {
  value: JobRequirements
  onChange: (value: JobRequirements) => void
  onSave: () => void
}

export function JobRequirementsForm({
  value,
  onChange,
  onSave,
}: JobRequirementsFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [skillName, setSkillName] = useState('')

  const handleRoleChange = (role: string) => {
    setSaved(false)
    onChange({ ...value, role })
  }

  const handleSkillNameChange = (name: string) => {
    setSaved(false)
    setSkillName(name)
  }

  const handleAddSkill = () => {
    const normalizedNames = skillName
      .split(/[,;]/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter(
        (name, index, names) =>
          names.findIndex(
            (candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase(),
          ) === index,
      )

    if (normalizedNames.length === 0) {
      return
    }

    const existingSkillNames = new Set(
      value.skills.map((skill) => skill.name.toLocaleLowerCase()),
    )
    const newSkills: SkillRequirement[] = normalizedNames
      .filter((name) => !existingSkillNames.has(name.toLocaleLowerCase()))
      .map((name) => ({ name, points: 5 }))

    onChange({ ...value, skills: [...value.skills, ...newSkills] })
    setSkillName('')
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
    if (isValid) {
      onSave()
    }
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

      <label htmlFor="job-role">ROL / Puesto</label>
      {submitted && value.role.trim().length === 0 && (
        <p role="alert">Ingresá el rol del puesto.</p>
      )}
      <input
        id="job-role"
        name="role"
        type="text"
        value={value.role}
        onChange={(event) => handleRoleChange(event.target.value)}
        data-testid="job-role"
        required
      />

      <label htmlFor="job-skills">Habilidades solicitadas</label>
      {submitted && value.skills.length === 0 && (
        <p role="alert">Agregá al menos una habilidad.</p>
      )}
      <input
        id="job-skills"
        name="skills"
        type="text"
        value={skillName}
        onChange={(event) => handleSkillNameChange(event.target.value)}
        data-testid="job-skills"
      />
      <p>Separá varias habilidades con , o ;.</p>
      <button
        type="button"
        onClick={handleAddSkill}
        disabled={skillName.trim().length === 0}
        data-testid="add-skill"
      >
        Agregar
      </button>
      <label htmlFor="job-seniority">Años / seniority</label>
      {submitted && value.seniority.trim().length === 0 && (
        <p role="alert">Ingresá los años o el seniority requerido.</p>
      )}
      <input
        id="job-seniority"
        name="seniority"
        type="text"
        value={value.seniority}
        onChange={(event) => handleSeniorityChange(event.target.value)}
        data-testid="job-seniority"
        required
      />
      <label htmlFor="job-seniority-points">Valoración del seniority</label>
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