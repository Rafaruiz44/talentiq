import type { CandidateResume, JobRequirements } from '../types'

interface AnalysisControlsProps {
  requirements: JobRequirements
  resume: CandidateResume
  loading: boolean
  hasAnalyzed: boolean
  onAnalyze: () => Promise<void>
}

export function AnalysisControls({
  requirements,
  resume,
  loading,
  hasAnalyzed,
  onAnalyze,
}: AnalysisControlsProps) {
  const isDisabled =
    requirements.role.trim().length === 0 ||
    requirements.skills.length === 0 ||
    requirements.seniority.trim().length === 0 ||
    requirements.seniorityPoints < 1 ||
    resume.text.trim().length === 0

  return (
    <section aria-labelledby="analysis-controls-title">
      <h2 id="analysis-controls-title">Análisis inteligente</h2>
      <button
        className="analyze-button"
        type="button"
        onClick={onAnalyze}
        disabled={isDisabled || loading}
        data-testid="run-analysis"
      >
        {loading ? 'Analizando CV…' : hasAnalyzed ? 'Analizar de nuevo' : 'Analizar candidato'}
      </button>
      {loading && (
        <p role="status" data-testid="analysis-loading">
          Procesando análisis...
        </p>
      )}
    </section>
  )
}