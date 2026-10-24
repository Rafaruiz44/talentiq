export interface SkillRequirement {
  name: string
  points: number
}

export interface JobRequirements {
  role: string
  skills: SkillRequirement[]
  seniority: string
  seniorityPoints: number
  acceptanceThreshold: number
}

export interface JobRequirementsImport {
  sourceUrl: string
  requirements: JobRequirements
}

export interface CandidateResume {
  text: string
  fileName: string | null
  file?: File | null
  candidateId?: string
  candidateDocumentId?: string
}

export interface CandidateEvaluation {
  candidateName: string
  candidateEmail?: string | null
  candidatePhone?: string | null
  experienceArea?: string
  experienceAreas?: string[]
  roleArea?: string
  seniorityMatchesRole?: boolean
  earnedPoints: number
  totalPoints: number
  verdict: 'Apto' | 'No Apto'
  strengths: string[]
  gaps: string[]
  interviewQuestions: string[]
  reusedExistingEvaluation?: boolean
}