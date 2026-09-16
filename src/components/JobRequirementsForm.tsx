import { useState } from 'react'
import type { JobRequirements } from '../types'

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
  const [skillsText, setSkillsText] = useState(value.skills.join(', '))

  const handleRoleChange = (role: string) => {
    setSaved(false)
    onChange({ ...value, role })
  }

  const handleSkillsChange = (skillsText: string) => {
    setSaved(false)
    setSkillsText(skillsText)

    const skills = skillsText
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0)

    onChange({ ...value, skills })
  }

  const handleSeniorityChange = (seniority: string) => {
    setSaved(false)
    onChange({ ...value, seniority })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    const isValid =
      value.role.trim().length > 0 &&
      value.skills.length > 0 &&
      value.seniority.trim().length > 0

    setSaved(isValid)
  }

  const isInvalid = submitted && (
    value.role.trim().length === 0 ||
    value.skills.length === 0 ||
    value.seniority.trim().length === 0
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
        value={skillsText}
        onChange={(event) => handleSkillsChange(event.target.value)}
        data-testid="job-skills"
        required
      />
      {submitted && value.skills.length === 0 && (
        <p role="alert">Ingresá al menos una tecnología excluyente.</p>
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