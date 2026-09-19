import type { JobRequirements } from '../types'

interface JobRequirementsSummaryProps {
  requirements: JobRequirements
  onChange: (requirements: JobRequirements) => void
}

export function JobRequirementsSummary({
  requirements,
  onChange,
}: JobRequirementsSummaryProps) {
  const handleSkillPointsChange = (skillIndex: number, points: string) => {
    onChange({
      ...requirements,
      skills: requirements.skills.map((skill, index) =>
        index === skillIndex ? { ...skill, points: Number(points) } : skill,
      ),
    })
  }

  const handleRemoveSkill = (skillIndex: number) => {
    onChange({
      ...requirements,
      skills: requirements.skills.filter((_, index) => index !== skillIndex),
    })
  }

  const handleSeniorityPointsChange = (points: string) => {
    onChange({
      ...requirements,
      seniorityPoints: Number(points),
    })
  }

  return (
    <section
      aria-labelledby="job-requirements-summary-title"
      data-testid="job-requirements-summary"
    >
      <h2 id="job-requirements-summary-title">Valoración de requerimientos</h2>

      <div className="requirements-summary-row">
        <strong>ROL / Puesto</strong>
        <span>{requirements.role}</span>
      </div>

      <div className="requirements-summary-group">
        <h3>Habilidades solicitadas</h3>
        {requirements.skills.map((skill, index) => (
          <div
            className="requirements-summary-row"
            key={`${skill.name}-${index}`}
            data-testid={`summary-skill-${index}`}
          >
            <span>{skill.name}</span>
            <input
              aria-label={`Valoración de ${skill.name}`}
              type="range"
              min="1"
              max="10"
              value={skill.points}
              onChange={(event) =>
                handleSkillPointsChange(index, event.target.value)
              }
              data-testid={`summary-skill-bar-${index}`}
            />
            <output>{skill.points}</output>
            <button
              type="button"
              className="remove-skill-button"
              aria-label={`Eliminar ${skill.name}`}
              onClick={() => handleRemoveSkill(index)}
              data-testid={`remove-summary-skill-${index}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="requirements-summary-row">
        <strong>Seniority</strong>
        <span>{requirements.seniority}</span>
        <input
          aria-label="Valoración del seniority"
          type="range"
          min="1"
          max="10"
          value={requirements.seniorityPoints}
          onChange={(event) =>
            handleSeniorityPointsChange(event.target.value)
          }
          data-testid="summary-seniority-bar"
        />
        <output>{requirements.seniorityPoints}</output>
      </div>
    </section>
  )
}
