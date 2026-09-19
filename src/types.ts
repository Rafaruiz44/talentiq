export interface SkillRequirement {
  name: string
  points: number
}

export interface JobRequirements {
  role: string
  skills: SkillRequirement[]
  seniority: string
  seniorityPoints: number
}

export interface JobRequirementsImport {
  sourceUrl: string
  requirements: JobRequirements
}

export interface CandidateResume {
  text: string
  fileName: string | null
}

export interface CandidateEvaluation {
  candidateName: string
  earnedPoints: number
  totalPoints: number
  verdict: 'Apto' | 'No Apto'
  strengths: string[]
  gaps: string[]
}