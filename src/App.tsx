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

  const handleAnalyze = () => {
    setEvaluation(inferCandidateEvaluation(jobRequirements, candidateResume))
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
        onAnalyze={handleAnalyze}
      />
      {evaluation && <EvaluationResults evaluation={evaluation} />}
    </main>
  )
}
