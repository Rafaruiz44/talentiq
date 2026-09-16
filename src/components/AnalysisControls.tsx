import type { CandidateResume, JobRequirements } from '../types'

interface AnalysisControlsProps {
  requirements: JobRequirements
  resume: CandidateResume
  onAnalyze: () => void
}

export function AnalysisControls({
  requirements,
  resume,
  onAnalyze,
}: AnalysisControlsProps) {
  const isDisabled =
    requirements.role.trim().length === 0 ||
    requirements.skills.length === 0 ||
    requirements.seniority.trim().length === 0 ||
    resume.text.trim().length === 0

  return (
    <section aria-labelledby="analysis-controls-title">
      <h2 id="analysis-controls-title">Análisis inteligente</h2>
      <button
        type="button"
        onClick={onAnalyze}
        disabled={isDisabled}
        data-testid="run-analysis"
      >
        Procesar análisis
      </button>
    </section>
  )
}