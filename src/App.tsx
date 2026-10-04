import { useEffect, useRef, useState } from 'react'
import { AnalysisControls } from './components/AnalysisControls'
import { CvUpload } from './components/CvUpload'
import { EvaluationResults } from './components/EvaluationResults'
import { JobRequirementsForm } from './components/JobRequirementsForm'
import { PositionList } from './components/PositionList'
import { saveCandidateDocument } from './services/candidates'
import { saveEvaluationRun } from './services/evaluations'
import { inferCandidateEvaluation } from './services/inferCandidateEvaluation'
import {
  listSavedPositions,
  savePosition,
  type SavedPosition,
} from './services/positions'
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

const getInitialPath = (): string =>
  window.location.pathname === '/' ? '/puestos' : window.location.pathname

export function App() {
  const [currentPath, setCurrentPath] = useState(getInitialPath)
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
  const [savedPositions, setSavedPositions] = useState<SavedPosition[]>([])
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    null,
  )
  const [positionsLoadedForUserId, setPositionsLoadedForUserId] = useState<
    string | null
  >(null)
  const [positionSaving, setPositionSaving] = useState(false)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [positionNotice, setPositionNotice] = useState<string | null>(null)
  const [candidateResume, setCandidateResume] = useState<CandidateResume>({
    text: '',
    fileName: null,
    file: null,
  })
  const [candidateSaveError, setCandidateSaveError] = useState<string | null>(
    null,
  )
  const [candidateSaveNotice, setCandidateSaveNotice] = useState<string | null>(
    null,
  )
  const [evaluation, setEvaluation] = useState<CandidateEvaluation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = (path: string) => {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

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
      setSavedPositions([])
      setSelectedPositionId(null)
      setPositionsLoadedForUserId(null)
      setPositionError(null)
      setPositionNotice(null)
      setCandidateResume({ text: '', fileName: null, file: null })
      setCandidateSaveError(null)
      setCandidateSaveNotice(null)
      setEvaluation(null)
      setLoading(false)
      setError(null)
      if (activeUserId.current === null || !nextUserId) {
        window.history.replaceState(null, '', '/puestos')
        setCurrentPath('/puestos')
      }
    }
    setSession(nextSession)
    setAuthLoading(false)
    if (nextSession) {
      setAuthError(null)
    }
  }

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', '/puestos')
    }
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

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

  useEffect(() => {
    const recruiterId = session?.user.id
    if (!recruiterId) {
      return
    }

    let isActive = true

    void listSavedPositions(recruiterId)
      .then((positions) => {
        if (isActive) {
          setSavedPositions(positions)
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setPositionError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar los puestos.',
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setPositionsLoadedForUserId(recruiterId)
        }
      })

    return () => {
      isActive = false
    }
  }, [session?.user.id])

  const routePath = currentPath.split('#')[0]
  const isPositionsList = routePath === '/puestos'
  const isNewPosition = routePath === '/puestos/nuevo'
  const editRouteMatch = routePath.match(/^\/puestos\/([^/]+)\/editar$/)
  const detailRouteMatch = routePath.match(/^\/puestos\/([^/]+)$/)
  const editingPositionId = editRouteMatch
    ? decodeURIComponent(editRouteMatch[1])
    : null
  const detailPositionId = detailRouteMatch
    ? decodeURIComponent(detailRouteMatch[1])
    : null
  const routePositionId = editingPositionId ?? detailPositionId
  const currentPosition = savedPositions.find(
    (position) => position.id === routePositionId,
  )
  const isPositionEditor = isNewPosition || Boolean(editingPositionId)
  const pageTitle = isPositionsList
    ? 'Puestos'
    : isNewPosition
      ? 'Crear puesto'
      : editingPositionId
        ? 'Editar puesto'
        : currentPosition?.title ?? 'Puesto'

  useEffect(() => {
    if (!routePositionId || !positionsLoadedForUserId) {
      return
    }
    const position = savedPositions.find((item) => item.id === routePositionId)
    if (position) {
      setSelectedPositionId(position.id)
      setJobRequirements(position.requirements)
    }
  }, [routePositionId, positionsLoadedForUserId, savedPositions])

  const handleRequirementsChange = (requirements: JobRequirements) => {
    setJobRequirements(requirements)
    setEvaluation(null)
    setPositionNotice(null)
  }

  const handleSelectPosition = (positionId: string) => {
    const position = savedPositions.find((item) => item.id === positionId)
    if (!position) {
      return
    }
    setSelectedPositionId(position.id)
    setJobRequirements(position.requirements)
    setEvaluation(null)
    setPositionError(null)
    setPositionNotice(null)
    navigate(`/puestos/${encodeURIComponent(position.id)}`)
  }

  const handleNewPosition = () => {
    setSelectedPositionId(null)
    setJobRequirements({
      role: '',
      skills: [],
      seniority: '',
      seniorityPoints: 5,
    })
    setEvaluation(null)
    setPositionError(null)
    setPositionNotice(null)
    navigate('/puestos/nuevo')
  }

  const handleEditPosition = (positionId: string) => {
    const position = savedPositions.find((item) => item.id === positionId)
    if (!position) {
      return
    }
    setSelectedPositionId(position.id)
    setJobRequirements(position.requirements)
    setPositionError(null)
    setPositionNotice(null)
    navigate(`/puestos/${encodeURIComponent(position.id)}/editar`)
  }

  const handleSavePosition = async () => {
    if (
      !session ||
      !jobRequirements.role.trim() ||
      !jobRequirements.skills.length ||
      !jobRequirements.seniority ||
      jobRequirements.seniorityPoints < 1
    ) {
      return
    }

    setPositionSaving(true)
    setPositionError(null)
    setPositionNotice(null)

    try {
      const positionId = await savePosition({
        positionId: selectedPositionId,
        requirements: jobRequirements,
      })
      const existingPosition = savedPositions.find(
        (position) => position.id === positionId,
      )
      const savedPosition: SavedPosition = {
        id: positionId,
        title: jobRequirements.role.trim(),
        requirements: {
          ...jobRequirements,
          role: jobRequirements.role.trim(),
        },
        status: existingPosition?.status ?? 'Nueva',
      }

      setSavedPositions((current) =>
        existingPosition
          ? current.map((position) =>
              position.id === positionId ? savedPosition : position,
            )
          : [savedPosition, ...current],
      )
      setSelectedPositionId(positionId)
      setPositionNotice(
        existingPosition ? 'Puesto actualizado.' : 'Puesto guardado.',
      )
      navigate(`/puestos/${encodeURIComponent(positionId)}`)
    } catch (saveError) {
      setPositionError(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar el puesto.',
      )
    } finally {
      setPositionSaving(false)
    }
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

  const handleResumeChange = (resume: CandidateResume) => {
    analysisRunId.current += 1
    setCandidateResume(resume)
    setLoading(false)
    setEvaluation(null)
    setError(null)
    setCandidateSaveError(null)
    setCandidateSaveNotice(null)
  }

  const handleAnalyze = async (
    requirements: JobRequirements = jobRequirements,
    positionId = selectedPositionId,
  ) => {
    const currentRunId = ++analysisRunId.current
    setLoading(true)
    setError(null)
    setCandidateSaveError(null)
    setCandidateSaveNotice(null)

    try {
      if (!session?.access_token) {
        throw new Error('Iniciá sesión nuevamente para analizar el CV.')
      }
      const result = await inferCandidateEvaluation(
        requirements,
        candidateResume,
        session.access_token,
        positionId ?? '',
      )
      if (currentRunId === analysisRunId.current) {
        setEvaluation(result)
      }

      if (currentRunId !== analysisRunId.current) {
        return
      }

      let savedCandidateId = candidateResume.candidateId
      let savedCandidateDocumentId = candidateResume.candidateDocumentId
      let reusedExistingCandidate = false
      let duplicateCleanupWarning = ''
      if (
        session?.user.id &&
        session.access_token &&
        candidateResume.file &&
        (!savedCandidateId || !savedCandidateDocumentId)
      ) {
        setCandidateSaveError(null)
        setCandidateSaveNotice(null)
        try {
          const savedCandidate = await saveCandidateDocument({
            accessToken: session.access_token,
            candidateName: result.candidateName,
            extractedText: candidateResume.text,
            file: candidateResume.file,
            recruiterId: session.user.id,
          })
          savedCandidateId = savedCandidate.candidateId
          savedCandidateDocumentId = savedCandidate.candidateDocumentId
          reusedExistingCandidate = savedCandidate.reusedExisting
          duplicateCleanupWarning = savedCandidate.cleanupWarning ?? ''
          setCandidateResume((currentResume) =>
            currentResume.file === candidateResume.file
              ? {
                  ...currentResume,
                  candidateId: savedCandidate.candidateId,
                  candidateDocumentId: savedCandidate.candidateDocumentId,
                }
              : currentResume,
          )
        } catch (saveError) {
          if (currentRunId === analysisRunId.current) {
            setCandidateSaveError(
              saveError instanceof Error
                ? `El análisis se completó, pero no se pudo guardar el CV ni su resultado: ${saveError.message}`
                : 'El análisis se completó, pero no se pudo guardar el CV ni su resultado.',
            )
          }
          return
        }
      }

      if (currentRunId !== analysisRunId.current) {
        return
      }

      if (
        !session?.access_token ||
        !positionId ||
        !savedCandidateId ||
        !savedCandidateDocumentId
      ) {
        setCandidateSaveError(
          'El análisis se completó, pero no se guardó en el historial porque falta un CV PDF guardado asociado a un puesto.',
        )
        return
      }

      try {
        let reusedExistingEvaluation = result.reusedExistingEvaluation ?? false
        if (!result.reusedExistingEvaluation) {
          reusedExistingEvaluation = await saveEvaluationRun({
            accessToken: session.access_token,
            candidateDocumentId: savedCandidateDocumentId,
            candidateId: savedCandidateId,
            evaluation: result,
            positionId,
            requirements,
            resumeText: candidateResume.text,
          })
        }
        if (currentRunId === analysisRunId.current) {
          setCandidateSaveError(null)
          setCandidateSaveNotice(
            reusedExistingEvaluation
              ? 'El CV y los requisitos no cambiaron; se reutilizó la evaluación existente sin agregar otra al historial.'
              : reusedExistingCandidate
                ? `El CV ya estaba en el banco; se reutilizó y se guardó una nueva evaluación en el historial del puesto.${duplicateCleanupWarning}`
                : `El resultado del análisis se guardó en el historial del puesto.${duplicateCleanupWarning}`,
          )
        }
      } catch (saveError) {
        if (currentRunId === analysisRunId.current) {
          setCandidateSaveError(
            saveError instanceof Error
              ? `El análisis se completó, pero no se pudo guardar en el historial: ${saveError.message}`
              : 'El análisis se completó, pero no se pudo guardar en el historial.',
          )
        }
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
    <div className="app-shell" data-theme={theme}>
      <aside className="app-sidebar" aria-label="Navegación de Talentiq">
        <a className="app-brand" href="#page-top">
          <span className="app-brand-mark" aria-hidden="true">
            T
          </span>
          <span>Talentiq</span>
        </a>
        <div className="sidebar-navigation">
          <p className="sidebar-label">Espacio de trabajo</p>
          <nav aria-label="Secciones">
            <a
              className={`sidebar-link${isPositionsList || isPositionEditor || detailPositionId ? ' sidebar-link-active' : ''}`}
              href="/puestos"
              onClick={(event) => {
                event.preventDefault()
                navigate('/puestos')
              }}
            >
              <span className="sidebar-link-mark" aria-hidden="true">
                P
              </span>
              Puestos
            </a>
            <a
              className={`sidebar-link${detailPositionId ? ' sidebar-link-active' : ''}`}
              href={
                selectedPositionId
                  ? `/puestos/${encodeURIComponent(selectedPositionId)}#cv-analysis`
                  : '/puestos'
              }
              onClick={(event) => {
                event.preventDefault()
                if (selectedPositionId) {
                  navigate(
                    `/puestos/${encodeURIComponent(selectedPositionId)}#cv-analysis`,
                  )
                } else {
                  navigate('/puestos')
                }
              }}
            >
              <span className="sidebar-link-mark" aria-hidden="true">
                A
              </span>
              Evaluación de CV
            </a>
          </nav>
        </div>
        <div className="sidebar-account">
          <span className="sidebar-label">Cuenta</span>
          <span className="sidebar-account-email" data-testid="signed-in-user">
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
        </div>
      </aside>

      <main className="app-main" id="page-top" data-theme={theme}>
        <header className="app-header">
          <p className="header-breadcrumb">
            Talentiq <span aria-hidden="true">/</span>{' '}
            <strong>{pageTitle}</strong>
          </p>
          <button
            type="button"
            className="theme-toggle-button"
            onClick={handleToggleTheme}
            aria-label={
              theme === 'light'
                ? 'Cambiar a modo oscuro'
                : 'Cambiar a modo claro'
            }
            data-testid="theme-toggle"
          >
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
        </header>
        {authError && (
          <p role="alert" data-testid="auth-error">
            {authError}
          </p>
        )}

        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">GESTIÓN DE TALENTO</p>
            <h1 id="page-title">{pageTitle}</h1>
            <p>
              {isPositionsList
                ? 'Organizá tus búsquedas y elegí una posición para continuar.'
                : isPositionEditor
                  ? 'Definí el rol, las habilidades requeridas y su ponderación.'
                  : currentPosition
                    ? 'Revisá los requisitos y analizá CVs para esta posición.'
                    : 'No encontramos el puesto solicitado.'}
            </p>
          </div>
        </section>

        {isPositionsList && (
          <section className="page-surface" id="positions">
            {positionError && (
              <p role="alert" data-testid="position-error">
                {positionError}
              </p>
            )}
            <PositionList
              positions={savedPositions}
              loading={
                Boolean(session.user.id) &&
                positionsLoadedForUserId !== session.user.id
              }
              onCreate={handleNewPosition}
              onOpen={handleSelectPosition}
            />
          </section>
        )}

        {isPositionEditor && (
          <section className="page-surface editor-surface">
            <div className="editor-back-row">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  navigate(
                    editingPositionId
                      ? `/puestos/${encodeURIComponent(editingPositionId)}`
                      : '/puestos',
                  )
                }
              >
                Volver
              </button>
            </div>
            <JobRequirementsForm
              value={jobRequirements}
              onChange={handleRequirementsChange}
            />
            {positionError && (
              <p role="alert" data-testid="position-error">
                {positionError}
              </p>
            )}
            <div className="editor-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/puestos')}
                disabled={positionSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSavePosition()}
                disabled={
                  positionSaving ||
                  !jobRequirements.role.trim() ||
                  !jobRequirements.skills.length ||
                  !jobRequirements.seniority ||
                  jobRequirements.seniorityPoints < 1
                }
                data-testid="save-position"
              >
                {positionSaving
                  ? 'Guardando...'
                  : editingPositionId
                    ? 'Guardar cambios'
                    : 'Crear puesto'}
              </button>
            </div>
          </section>
        )}

        {detailPositionId && !currentPosition && (
          <section className="page-surface not-found-surface">
            <p>
              {positionsLoadedForUserId === session.user.id
                ? 'El puesto no existe o no está disponible para esta cuenta.'
                : 'Cargando puesto...'}
            </p>
            <button type="button" onClick={() => navigate('/puestos')}>
              Volver a puestos
            </button>
          </section>
        )}

        {currentPosition && !editingPositionId && (
          <>
            <section
              className="page-surface position-detail-surface"
              data-testid="position-detail"
            >
              <div className="detail-title-row">
                <div>
                  <p className="eyebrow">DETALLE DE POSICIÓN</p>
                  <h2>{currentPosition.title}</h2>
                </div>
                <div className="detail-actions">
                  <span
                    className={`status-badge status-${currentPosition.status.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    {currentPosition.status}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      handleEditPosition(currentPosition.id)
                    }
                  >
                    Editar puesto
                  </button>
                </div>
              </div>
              {positionNotice && (
                <p role="status" data-testid="position-notice">
                  {positionNotice}
                </p>
              )}
              <dl className="position-requirements-grid">
                <div>
                  <dt>Seniority</dt>
                  <dd>{currentPosition.requirements.seniority}</dd>
                </div>
                <div>
                  <dt>Peso del seniority</dt>
                  <dd>{currentPosition.requirements.seniorityPoints} / 10</dd>
                </div>
                <div>
                  <dt>Habilidades requeridas</dt>
                  <dd>{currentPosition.requirements.skills.length}</dd>
                </div>
              </dl>
              <div className="detail-skills">
                <h3>Habilidades y ponderación</h3>
                <ul>
                  {currentPosition.requirements.skills.map((skill) => (
                    <li key={skill.name}>
                      <span>{skill.name}</span>
                      <span>{skill.points} / 10</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div
              className="analysis-workspace"
              id="cv-analysis"
              data-testid="analysis-workspace"
            >
              <CvUpload
                value={candidateResume}
                onChange={handleResumeChange}
              />
              <div
                className="analysis-controls-column"
                data-testid="analysis-controls-column"
              >
                <AnalysisControls
                  requirements={currentPosition.requirements}
                  resume={candidateResume}
                  loading={loading}
                  onAnalyze={() =>
                    handleAnalyze(
                      currentPosition.requirements,
                      currentPosition.id,
                    )
                  }
                />
                {error && (
                  <p role="alert" data-testid="error-message">
                    {error}
                  </p>
                )}
                {candidateSaveError && (
                  <p role="alert" data-testid="candidate-save-error">
                    {candidateSaveError}
                  </p>
                )}
                {candidateSaveNotice && (
                  <p role="status" data-testid="candidate-save-notice">
                    {candidateSaveNotice}
                  </p>
                )}
                {evaluation && (
                  <EvaluationResults evaluation={evaluation} />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
