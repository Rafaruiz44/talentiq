export interface JobRequirements {
  role: string
  skills: string[]
  seniority: string
}

export interface CandidateResume {
  text: string
  fileName: string | null
}

export interface CandidateEvaluation {
  candidateName: string
  matchScore: number
  verdict: 'Apto' | 'No Apto'
  strengths: string[]
  gaps: string[]
}