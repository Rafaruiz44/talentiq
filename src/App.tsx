import { useEffect, useState } from 'react'
import { AnalysisControls } from './components/AnalysisControls'
import { CvUpload } from './components/CvUpload'
import { EvaluationResults } from './components/EvaluationResults'
import { JobRequirementsForm } from './components/JobRequirementsForm'
import { JobRequirementsSummary } from './components/JobRequirementsSummary'
import { inferCandidateEvaluation } from './services/inferCandidateEvaluation'
import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
} from './types'

const getInitialTheme = (): 'light' | 'dark' => {
  const storedTheme = sessionStorage.getItem('talentiq-theme')
  return storedTheme === 'dark' ? 'dark' : 'light'
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    role: '',
    skills: [],
    seniority: '',
    seniorityPoints: 5,
  })
  const [candidateResume, setCandidateResume] = useState<CandidateResume>({
    text: '',
    fileName: null,
  })
  const [evaluation, setEvaluation] = useState<CandidateEvaluation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requirementsSaved, setRequirementsSaved] = useState(false)

  const handleRequirementsChange = (requirements: JobRequirements) => {
    setJobRequirements(requirements)
  }

  useEffect(() => {
    sessionStorage.setItem('talentiq-theme', theme)
  }, [theme])

  const handleToggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }

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
    <main data-theme={theme}>
      <header className="app-header">
        <h1>Talentiq</h1>
        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          data-testid="theme-toggle"
        >
          {theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        </button>
      </header>
      <JobRequirementsForm
        value={jobRequirements}
        onChange={handleRequirementsChange}
        onSave={() => setRequirementsSaved(true)}
      />
      {requirementsSaved && (
        <JobRequirementsSummary
          requirements={jobRequirements}
          onChange={handleRequirementsChange}
        />
      )}
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
