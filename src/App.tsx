import { useState } from 'react'
import { AnalysisControls } from './components/AnalysisControls'
import { CvUpload } from './components/CvUpload'
import { EvaluationResults } from './components/EvaluationResults'
import { JobRequirementsForm } from './components/JobRequirementsForm'
import { inferCandidateEvaluation } from './services/inferCandidateEvaluation'
import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
} from './types'

export function App() {
  const [darkMode, setDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    role: '',
    skills: [],
    seniority: '',
    weights: {
      role: 40,
      skills: 40,
      seniority: 20,
    },
  })
  const [candidateResume, setCandidateResume] = useState<CandidateResume>({
    text: '',
    fileName: null,
  })
  const [evaluation, setEvaluation] = useState<CandidateEvaluation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await inferCandidateEvaluation(
        jobRequirements,
        candidateResume,
      )
      setEvaluation(result)
    } catch (analysisError) {
      setEvaluation(null)
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'No se pudo completar el análisis.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={darkMode ? 'dark-mode' : ''}>
      <h1>Talentiq</h1>
      <button
        type="button"
        onClick={() => setDarkMode((isDark) => !isDark)}
        data-testid="theme-toggle"
        aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="theme-toggle"
      >
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
      </button>
      <JobRequirementsForm
        value={jobRequirements}
        onChange={setJobRequirements}
      />
      <CvUpload value={candidateResume} onChange={setCandidateResume} />
      <AnalysisControls
        requirements={jobRequirements}
        resume={candidateResume}
        loading={loading}
        onAnalyze={handleAnalyze}
      />
      {error && (
        <p role="alert" data-testid="error-message">
          {error}
        </p>
      )}
      {evaluation && <EvaluationResults evaluation={evaluation} />}
    </main>
  )
}
