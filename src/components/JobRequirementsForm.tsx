import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { JobRequirements, SkillRequirement } from '../types'

interface JobRequirementsFormProps {
  value: JobRequirements
  onChange: (value: JobRequirements) => void
}

const sanitizeSkillName = (name: string): string => name.replace(/[<>&"]/g, '').trim()

export function JobRequirementsForm({ value, onChange }: JobRequirementsFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillPoints, setSkillPoints] = useState(5)

  const handleRoleChange = (role: string) => {
    onChange({ ...value, role })
  }

  const handleSkillNameChange = (name: string) => {
    setSkillName(name)
  }

  const handleSkillPointsChange = (points: string) => {
    setSkillPoints(Number(points))
  }

  const handleAddSkill = () => {
    const name = sanitizeSkillName(skillName)
    if (!name || value.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) return
    const newSkill: SkillRequirement = { name, points: skillPoints }
    onChange({ ...value, skills: [...value.skills, newSkill] })
    setSkillName('')
    setSkillPoints(5)
  }

  const handleSkillKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddSkill()
    }
  }

  const handleRemoveSkill = (index: number) => {
    onChange({ ...value, skills: value.skills.filter((_, itemIndex) => itemIndex !== index) })
  }

  const handleSeniorityChange = (seniority: string) => {
    onChange({ ...value, seniority })
  }

  const handleSeniorityPointsChange = (points: string) => {
    onChange({ ...value, seniorityPoints: Number(points) })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  const isInvalid = submitted && (!value.role.trim() || !value.skills.length || !value.seniority || value.seniorityPoints < 1)

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="step-heading"><span className="step-number">1</span><h2>Puesto</h2></div>
      <label htmlFor="job-role">Nombre del puesto</label>
      <input id="job-role" name="role" type="text" value={value.role} placeholder="Ej: Desarrollador Backend Python" onChange={(event) => handleRoleChange(event.target.value)} data-testid="job-role" required />
      {submitted && !value.role.trim() && <p role="alert">Ingresá el rol del puesto.</p>}

      <div className="step-heading"><span className="step-number">2</span><div><h2>Habilidades</h2><p className="field-help">cada una con su peso (1-10)</p></div></div>
      <div className="field-row skill-entry-row">
        <label htmlFor="job-skills">Habilidad</label>
        <input id="job-skills" name="skills" type="text" value={skillName} placeholder="Ej: SQL" onChange={(event) => handleSkillNameChange(event.target.value)} onKeyDown={handleSkillKeyDown} data-testid="job-skills" />
        <label htmlFor="skill-points">Peso <strong className="range-value">{skillPoints}</strong></label>
        <input id="skill-points" name="skill-points" type="range" min="1" max="10" value={skillPoints} onChange={(event) => handleSkillPointsChange(event.target.value)} data-testid="skill-points" />
        <button type="button" onClick={handleAddSkill} disabled={!skillName.trim()} data-testid="add-skill">+ Agregar</button>
      </div>
      {value.skills.length === 0 ? <p className="empty-skills">Todavía no agregaste habilidades.</p> : (
        <ul data-testid="skills-list" className="skills-list">
          {value.skills.map((skill, index) => <li key={`${skill.name}-${index}`} className="skill-item"><strong>{skill.name}</strong><span className="skill-bar-track" aria-hidden="true"><span className="skill-bar" style={{ width: `${skill.points * 10}%` }} /></span><span>{skill.points}</span><button type="button" onClick={() => handleRemoveSkill(index)} aria-label={`Quitar ${skill.name}`} data-testid={`remove-skill-${index}`}>✕</button></li>)}
        </ul>
      )}
      {submitted && !value.skills.length && <p role="alert">Agregá al menos una habilidad.</p>}

      <div className="step-heading"><span className="step-number">3</span><h2>Seniority requerido</h2></div>
      <div className="field-row seniority-row">
        <label htmlFor="job-seniority">Nivel</label>
        <select id="job-seniority" name="seniority" value={value.seniority} onChange={(event) => handleSeniorityChange(event.target.value)} data-testid="job-seniority">
          <option value="" disabled>Seleccionar</option>
          <option value="Trainee">Trainee</option>
          <option value="Junior">Junior</option>
          <option value="Semi Senior">Semi Senior</option>
          <option value="Senior">Senior</option>
          <option value="Lead">Lead</option>
        </select>
        <label htmlFor="job-seniority-points">Peso <strong className="range-value">{value.seniorityPoints}</strong></label>
        <input id="job-seniority-points" name="seniority-points" type="range" min="1" max="10" value={value.seniorityPoints} onChange={(event) => handleSeniorityPointsChange(event.target.value)} data-testid="job-seniority-points" />
      </div>

      {isInvalid && <p role="status">Completá todos los campos obligatorios.</p>}
    </form>
  )
}
