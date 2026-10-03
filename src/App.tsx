import { useEffect, useRef, useState } from 'react'
import { AnalysisControls } from './components/AnalysisControls'
import { CvUpload } from './components/CvUpload'
import { EvaluationResults } from './components/EvaluationResults'
import { JobRequirementsForm } from './components/JobRequirementsForm'
import { inferCandidateEvaluation } from './services/inferCandidateEvaluation'
import {
  getCurrentSession,
  getSupabaseAuthErrorMessage,
  isSupabaseConfigured,
  signInWithGoogle,
  signOutCurrentUser,
  subscribeToAuthChanges,
} from './services/authSession'
import { supabaseConfigurationError } from './services/supabaseClient'
import { AuthScreen } from './components/AuthScreen'
import type { Session } from '@supabase/supabase-js'
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
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const activeUserId = useRef<string | null>(null)
  const analysisRunId = useRef(0)
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

  const updateSession = (nextSession: Session | null) => {
    const nextUserId = nextSession?.user.id ?? null
    if (activeUserId.current !== nextUserId) {
      activeUserId.current = nextUserId
      analysisRunId.current += 1
      setJobRequirements({
        role: '',
        skills: [],
        seniority: '',
        seniorityPoints: 5,
      })
      setCandidateResume({ text: '', fileName: null })
      setEvaluation(null)
      setLoading(false)
      setError(null)
    }
    setSession(nextSession)
    setAuthLoading(false)
    if (nextSession) {
      setAuthError(null)
    }
  }

  useEffect(() => {
    let isActive = true
    const unsubscribe = subscribeToAuthChanges((_event, nextSession) => {
      if (isActive) {
        updateSession(nextSession)
      }
    })

    void getCurrentSession()
      .then((nextSession) => {
        if (!isActive) {
          return
        }
        updateSession(nextSession)
      })
      .catch((sessionError: unknown) => {
        if (isActive) {
          setAuthError(
            getSupabaseAuthErrorMessage(
              sessionError,
              'No se pudo verificar la sesión.',
            ),
          )
          setSession(null)
        }
      })
      .finally(() => {
        if (isActive) {
          setAuthLoading(false)
        }
      })

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  const handleRequirementsChange = (requirements: JobRequirements) => {
    setJobRequirements(requirements)
  }

  const handleSignIn = async () => {
    setSigningIn(true)
    setAuthError(null)

    try {
      await signInWithGoogle()
    } catch (signInError) {
      setAuthError(
        getSupabaseAuthErrorMessage(
          signInError,
          'No se pudo iniciar sesión con Google.',
        ),
      )
      setSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setAuthError(null)

    try {
      await signOutCurrentUser()
    } catch (signOutError) {
      setAuthError(
        getSupabaseAuthErrorMessage(
          signOutError,
          'No se pudo cerrar la sesión.',
        ),
      )
    } finally {
      setSigningOut(false)
    }
  }

  useEffect(() => {
    sessionStorage.setItem('talentiq-theme', theme)
  }, [theme])

  const handleToggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }

  const handleAnalyze = async () => {
    const currentRunId = ++analysisRunId.current
    setLoading(true)
    setError(null)

    try {
      const result = await inferCandidateEvaluation(
        jobRequirements,
        candidateResume,
      )
      if (currentRunId === analysisRunId.current) {
        setEvaluation(result)
      }
    } catch (analysisError) {
      if (currentRunId === analysisRunId.current) {
        setEvaluation(null)
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : 'No se pudo completar el análisis.',
        )
      }
    } finally {
      if (currentRunId === analysisRunId.current) {
        setLoading(false)
      }
    }
  }

  if (authLoading || !session) {
    return (
      <AuthScreen
        configurationError={supabaseConfigurationError}
        error={authError}
        loading={authLoading}
        signingIn={signingIn}
        onSignIn={handleSignIn}
      />
    )
  }

  return (
    <main data-theme={theme}>
      <header className="app-header">
        <h1>Talentiq</h1>
        <span data-testid="signed-in-user">
          {session.user.email ?? 'Sesión iniciada'}
        </span>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          data-testid="sign-out"
        >
          {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          data-testid="theme-toggle"
        >
          {theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        </button>
      </header>
      {authError && (
        <p role="alert" data-testid="auth-error">
          {authError}
        </p>
      )}
      <JobRequirementsForm
        value={jobRequirements}
        onChange={handleRequirementsChange}
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
