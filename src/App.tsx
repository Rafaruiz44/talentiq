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
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    role: '',
    skills: [],
    seniority: '',
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
    <main>
      <h1>Talentiq</h1>
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
