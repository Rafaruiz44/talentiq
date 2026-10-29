import { useEffect, useRef, useState } from 'react'
import { JobRequirementsForm } from './components/JobRequirementsForm'
import { PositionList } from './components/PositionList'
import {
  CandidateBank,
  type CandidateEvaluationFeedback,
} from './components/CandidateBank'
import { ApplicationIntake } from './components/ApplicationIntake'
import { PositionRanking } from './components/PositionRanking'
import {
  getSavedCandidateResume,
  listSavedCandidates,
  updateCandidateContactInfo,
  type SavedCandidate,
} from './services/candidates'
import { listRankedApplications } from './services/applicationRanking'
import { saveEvaluationRun } from './services/evaluations'
import { inferCandidateEvaluation } from './services/inferCandidateEvaluation'
import {
  listSavedPositions,
  savePosition,
  updatePositionStatus,
  type PositionStatus,
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
import type { JobRequirements } from './types'

const getInitialTheme = (): 'light' | 'dark' => {
  const storedTheme = sessionStorage.getItem('talentiq-theme')
  return storedTheme === 'dark' ? 'dark' : 'light'
}

const getInitialPath = (): string =>
  window.location.pathname === '/' ? '/puestos' : window.location.pathname

const normalizeSkills = (requirements: JobRequirements) =>
  [...requirements.skills]
    .map(({ name, points }) => ({ name: name.trim(), points }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es-AR'))

const haveSameEvaluationRequirements = (
  previous: JobRequirements,
  next: JobRequirements,
) =>
  previous.seniority === next.seniority &&
  previous.seniorityPoints === next.seniorityPoints &&
  JSON.stringify(normalizeSkills(previous)) ===
    JSON.stringify(normalizeSkills(next))

export function App() {
  const [currentPath, setCurrentPath] = useState(getInitialPath)
  const currentPathRef = useRef(currentPath)
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const activeUserId = useRef<string | null>(null)
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    role: '',
    skills: [],
    seniority: '',
    seniorityPoints: 5,
    acceptanceThreshold: 70,
  })
  const [savedPositions, setSavedPositions] = useState<SavedPosition[]>([])
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    null,
  )
  const [positionsLoadedForUserId, setPositionsLoadedForUserId] = useState<
    string | null
  >(null)
  const [savedCandidates, setSavedCandidates] = useState<SavedCandidate[]>([])
  const [candidatesLoadedForUserId, setCandidatesLoadedForUserId] = useState<
    string | null
  >(null)
  const [candidateListRefreshKey, setCandidateListRefreshKey] = useState(0)
  const [candidateBankError, setCandidateBankError] = useState<string | null>(
    null,
  )
  const [candidateBankNotice, setCandidateBankNotice] = useState<string | null>(
    null,
  )
  const [candidateEvaluationResult, setCandidateEvaluationResult] =
    useState<CandidateEvaluationFeedback | null>(null)
  const [loadingCandidateDocumentId, setLoadingCandidateDocumentId] = useState<
    string | null
  >(null)
  const [positionSaving, setPositionSaving] = useState(false)
  const savePositionRequested = useRef(false)
  const positionReevaluationInProgress = useRef(false)
  const [positionStatusSavingId, setPositionStatusSavingId] = useState<
    string | null
  >(null)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [positionNotice, setPositionNotice] = useState<string | null>(null)
  const [applicationStatusError, setApplicationStatusError] = useState<
    string | null
  >(null)
  currentPathRef.current = currentPath
  const navigate = (path: string) => {
    if (
      positionReevaluationInProgress.current &&
      !window.confirm(
        'Hay una actualización de candidatos en curso. Si salís ahora, se perderán los cambios que todavía no se hayan guardado. ¿Querés salir?',
      )
    ) {
      return
    }
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

  const updateSession = (nextSession: Session | null) => {
    const nextUserId = nextSession?.user.id ?? null
    if (activeUserId.current !== nextUserId) {
      activeUserId.current = nextUserId
      setJobRequirements({
        role: '',
        skills: [],
        seniority: '',
        seniorityPoints: 5,
        acceptanceThreshold: 70,
      })
      setSavedPositions([])
      setSelectedPositionId(null)
      setPositionsLoadedForUserId(null)
      setSavedCandidates([])
      setCandidatesLoadedForUserId(null)
      setCandidateBankError(null)
      setCandidateBankNotice(null)
      setCandidateEvaluationResult(null)
      setLoadingCandidateDocumentId(null)
      setPositionStatusSavingId(null)
      setPositionError(null)
      setPositionNotice(null)
      setApplicationStatusError(null)
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
      const nextPath = window.location.pathname
      if (
        positionReevaluationInProgress.current &&
        !window.confirm(
          'Hay una actualización de candidatos en curso. Si salís ahora, se perderán los cambios que todavía no se hayan guardado. ¿Querés salir?',
        )
      ) {
        window.history.pushState(null, '', currentPathRef.current)
        return
      }
      setCurrentPath(nextPath)
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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!positionReevaluationInProgress.current) {
        return
      }

      event.preventDefault()
      event.returnValue =
        'Hay una actualización de candidatos en curso. Si salís ahora, se perderán los cambios que todavía no se hayan guardado.'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const routePath = currentPath.split(/[?#]/, 1)[0]
  const isPositionsList = routePath === '/puestos'
  const isCandidatesList = routePath === '/candidatos'
  const isApplicationsPage = routePath === '/postulaciones'
  const isRankingPage = routePath === '/ranking'
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
    : isCandidatesList
      ? 'Candidatos'
      : isApplicationsPage
        ? 'Postulaciones'
        : isRankingPage
          ? 'Ranking'
          : isNewPosition
            ? 'Crear puesto'
            : editingPositionId
              ? 'Editar puesto'
              : currentPosition?.title ?? 'Puesto'
  const breadcrumbItems = [
    { label: 'Talentiq', path: '/puestos' },
    ...(isPositionsList || isPositionEditor || currentPosition
      ? [{ label: 'Puestos', path: '/puestos' }]
      : []),
    ...(currentPosition
      ? [
          {
            label: currentPosition.title,
            path: `/puestos/${encodeURIComponent(currentPosition.id)}`,
          },
        ]
      : []),
    ...(isNewPosition ? [{ label: 'Crear puesto', path: null }] : []),
    ...(editingPositionId
      ? [{ label: 'Editar puesto', path: null }]
      : []),
    ...(!isPositionsList &&
    !isCandidatesList &&
    !isApplicationsPage &&
    !isRankingPage &&
    !isPositionEditor &&
    !currentPosition
      ? [{ label: pageTitle, path: null }]
      : []),
    ...(isCandidatesList ? [{ label: 'Candidatos', path: null }] : []),
    ...(isApplicationsPage
      ? [{ label: 'Postulaciones', path: null }]
      : []),
    ...(isRankingPage ? [{ label: 'Ranking', path: null }] : []),
  ]

  useEffect(() => {
    const recruiterId = session?.user.id
    if (!recruiterId) {
      return
    }

    let isActive = true
    void listSavedCandidates(recruiterId)
      .then((candidates) => {
        if (isActive) {
          setSavedCandidates(candidates)
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setCandidateBankError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudieron cargar los candidatos.',
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setCandidatesLoadedForUserId(recruiterId)
        }
      })

    return () => {
      isActive = false
    }
  }, [session?.user.id, candidateListRefreshKey])

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
    setPositionNotice(null)
  }

  const handleSelectPosition = (positionId: string) => {
    const position = savedPositions.find((item) => item.id === positionId)
    if (!position) {
      return
    }
    setSelectedPositionId(position.id)
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
        acceptanceThreshold: 70,
    })
    setPositionError(null)
    setPositionNotice(null)
    navigate('/puestos/nuevo')
  }

  const handleUpdatePositionStatus = async (
    positionId: string,
    status: PositionStatus,
  ) => {
    const recruiterId = session?.user.id
    if (!recruiterId) {
      setApplicationStatusError(
        'Iniciá sesión nuevamente para actualizar la postulación.',
      )
      return
    }

    const previousStatus = savedPositions.find(
      (position) => position.id === positionId,
    )?.status
    if (!previousStatus) {
      setApplicationStatusError(
        'La postulación seleccionada ya no está disponible.',
      )
      return
    }

    setPositionStatusSavingId(positionId)
    setApplicationStatusError(null)
    setSavedPositions((current) =>
      current.map((position) =>
        position.id === positionId ? { ...position, status } : position,
      ),
    )
    try {
      await updatePositionStatus({ positionId, recruiterId, status })
    } catch (statusError: unknown) {
      if (activeUserId.current === recruiterId) {
        setSavedPositions((current) =>
          current.map((position) =>
            position.id === positionId
              ? { ...position, status: previousStatus }
              : position,
          ),
        )
        setApplicationStatusError(
          statusError instanceof Error
            ? statusError.message
            : 'No se pudo actualizar la postulación.',
        )
      }
    } finally {
      if (activeUserId.current === recruiterId) {
        setPositionStatusSavingId(null)
      }
    }
  }

  const handleUseSavedCandidate = async (
    candidateId: string,
    candidateDocumentId: string,
    positionId: string,
  ) => {
    const recruiterId = session?.user.id
    const accessToken = session?.access_token
    if (!recruiterId || !accessToken) {
      setCandidateBankError('Iniciá sesión nuevamente para usar este CV.')
      return
    }
    const position = savedPositions.find((item) => item.id === positionId)
    if (!position) {
      setCandidateBankError('El puesto seleccionado ya no está disponible.')
      return
    }
    if (position.status === 'Cerrada') {
      setCandidateBankError('Abrir postulación para cargar CVs')
      return
    }

    setLoadingCandidateDocumentId(candidateDocumentId)
    setCandidateBankError(null)
    setCandidateBankNotice(null)
    try {
      const resume = await getSavedCandidateResume({
        recruiterId,
        candidateId,
        candidateDocumentId,
      })
      if (activeUserId.current !== recruiterId) {
        return
      }
      const evaluation = await inferCandidateEvaluation(
        position.requirements,
        {
        text: resume.text,
        fileName: resume.fileName,
        file: null,
        candidateId: resume.candidateId,
        candidateDocumentId: resume.candidateDocumentId,
        },
        accessToken,
        position.id,
      )
      const savedEvaluation = await saveEvaluationRun({
        accessToken,
        candidateDocumentId: resume.candidateDocumentId,
        candidateId: resume.candidateId,
        evaluation,
        positionId: position.id,
        requirements: position.requirements,
        resumeText: resume.text,
      })
      if (evaluation.candidateEmail || evaluation.candidatePhone) {
        void updateCandidateContactInfo({
          candidateId: resume.candidateId,
          email: evaluation.candidateEmail,
          phone: evaluation.candidatePhone,
        })
      }
      if (activeUserId.current === recruiterId) {
        const percentage = Math.round(
          (savedEvaluation.earnedPoints / savedEvaluation.totalPoints) * 100,
        )
        setCandidateEvaluationResult({
          candidateId: resume.candidateId,
          candidateName: evaluation.candidateName,
          verdict: savedEvaluation.verdict,
          percentage,
          positionTitle: position.title,
        })
        setCandidateBankNotice(
          `${evaluation.candidateName}: ${evaluation.verdict}, ${percentage}% de compatibilidad para ${position.title}.`,
        )
      }
    } catch (resumeError: unknown) {
      if (activeUserId.current === recruiterId) {
        setCandidateBankError(
          resumeError instanceof Error
            ? resumeError.message
            : 'No se pudo cargar el CV seleccionado.',
        )
      }
    } finally {
      if (activeUserId.current === recruiterId) {
        setLoadingCandidateDocumentId(null)
      }
    }
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
    if (!savePositionRequested.current) {
      return
    }
    savePositionRequested.current = false

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
        status: existingPosition?.status ?? 'Abierta',
      }

      setSavedPositions((current) =>
        existingPosition
          ? current.map((position) =>
              position.id === positionId ? savedPosition : position,
            )
          : [savedPosition, ...current],
      )
      setSelectedPositionId(positionId)
      navigate(`/puestos/${encodeURIComponent(positionId)}`)
      setPositionSaving(false)

      if (existingPosition) {
        setPositionNotice('Puesto actualizado.')
        const requirementsChanged = !haveSameEvaluationRequirements(
          existingPosition.requirements,
          savedPosition.requirements,
        )
        const thresholdChanged =
          existingPosition.requirements.acceptanceThreshold !==
          savedPosition.requirements.acceptanceThreshold

        if (!requirementsChanged && !thresholdChanged) {
          return
        }

        const isThresholdOnlyChange = !requirementsChanged && thresholdChanged
        positionReevaluationInProgress.current = true
        try {
          const evaluatedApps = await listRankedApplications(
            session.user.id,
            positionId,
          )

          if (evaluatedApps.length > 0) {
            setPositionNotice(
              isThresholdOnlyChange
                ? `Puesto actualizado. Actualizando la compatibilidad de ${
                    evaluatedApps.length
                  } candidato${evaluatedApps.length === 1 ? '' : 's'}...`
                : `Puesto actualizado. Re-analizando ${
                    evaluatedApps.length
                  } candidato${
                    evaluatedApps.length === 1 ? '' : 's'
                  } previamente evaluado${
                    evaluatedApps.length === 1 ? '' : 's'
                  }...`,
            )

            const results: Array<
              | { candidateName: string; success: true }
              | { candidateName: string; success: false; error: string }
            > = []
            for (let index = 0; index < evaluatedApps.length; index += 5) {
              const batch = evaluatedApps.slice(index, index + 5)
              const batchResults = await Promise.all(
                batch.map(async (app) => {
                try {
                  const resume = await getSavedCandidateResume({
                    recruiterId: session.user.id,
                    candidateId: app.candidateId,
                    candidateDocumentId: app.candidateDocumentId,
                  })

                  const evaluation = await inferCandidateEvaluation(
                    savedPosition.requirements,
                    {
                      text: resume.text,
                      fileName: resume.fileName,
                      candidateId: app.candidateId,
                      candidateDocumentId: app.candidateDocumentId,
                    },
                    session.access_token,
                    positionId,
                  )

                  await saveEvaluationRun({
                    accessToken: session.access_token,
                    candidateDocumentId: app.candidateDocumentId,
                    candidateId: app.candidateId,
                    evaluation,
                    positionId,
                    requirements: savedPosition.requirements,
                    resumeText: resume.text,
                  })

                  if (evaluation.candidateEmail || evaluation.candidatePhone) {
                    void updateCandidateContactInfo({
                      candidateId: app.candidateId,
                      email: evaluation.candidateEmail,
                      phone: evaluation.candidatePhone,
                    })
                  }

                  return { candidateName: app.candidateName, success: true as const }
                } catch (reEvalErr) {
                  return {
                    candidateName: app.candidateName,
                    success: false as const,
                    error:
                      reEvalErr instanceof Error
                        ? reEvalErr.message
                        : 'error desconocido',
                  }
                }
                }),
              )
              results.push(...batchResults)
            }
            const reEvaluatedCount = results.filter(
              (result) => result.success,
            ).length
            const failedCandidates = results
              .filter(
                (
                  result,
                ): result is {
                  candidateName: string
                  success: false
                  error: string
                } => !result.success,
              )
              .map(
                (result) => `${result.candidateName}: ${result.error}`,
              )

            if (failedCandidates.length > 0) {
              setPositionError(
                `Puesto actualizado. Se re-analizaron ${reEvaluatedCount} de ${
                  evaluatedApps.length
                } candidatos. Fallos: ${failedCandidates.join(' | ')}`,
              )
            } else {
              setPositionNotice(
                `Puesto actualizado y ${reEvaluatedCount} candidato${
                  reEvaluatedCount === 1 ? '' : 's'
                } re-analizado${reEvaluatedCount === 1 ? '' : 's'} exitosamente.`,
              )
            }
          }
        } catch (fetchEvaluatedErr) {
          setPositionError(
            fetchEvaluatedErr instanceof Error
              ? `Puesto actualizado, pero no se pudieron re-analizar los candidatos: ${fetchEvaluatedErr.message}`
              : 'Puesto actualizado, pero no se pudieron re-analizar los candidatos.',
          )
        } finally {
          positionReevaluationInProgress.current = false
        }
      } else {
        setPositionNotice('Puesto guardado.')
      }
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
              className={`sidebar-link${isCandidatesList ? ' sidebar-link-active' : ''}`}
              href="/candidatos"
              onClick={(event) => {
                event.preventDefault()
                navigate('/candidatos')
              }}
            >
              <span className="sidebar-link-mark" aria-hidden="true">
                C
              </span>
              Candidatos
            </a>
            <a
              className={`sidebar-link${isApplicationsPage ? ' sidebar-link-active' : ''}`}
              href="/postulaciones"
              onClick={(event) => {
                event.preventDefault()
                navigate('/postulaciones')
              }}
            >
              <span className="sidebar-link-mark" aria-hidden="true">
                +
              </span>
              Postulaciones
            </a>
            <a
              className={`sidebar-link${isRankingPage ? ' sidebar-link-active' : ''}`}
              href="/ranking"
              onClick={(event) => {
                event.preventDefault()
                navigate('/ranking')
              }}
            >
              <span className="sidebar-link-mark" aria-hidden="true">
                #
              </span>
              Ranking
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
          <nav className="header-breadcrumb" aria-label="Migas de pan">
            <ol>
              {breadcrumbItems.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  {item.path ? (
                    <button
                      type="button"
                      onClick={() => navigate(item.path ?? '/puestos')}
                      data-testid={`breadcrumb-${index}`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <strong>{item.label}</strong>
                  )}
                  {index < breadcrumbItems.length - 1 && (
                    <span aria-hidden="true">/</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
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
                : isCandidatesList
                  ? 'Consultá tus candidatos guardados y reutilizá sus CVs en otras posiciones.'
                  : isApplicationsPage
                    ? 'Cargá varios CVs para una posición y seguí el análisis individual de cada postulación.'
                    : isRankingPage
                      ? 'Compará las evaluaciones más recientes de los candidatos para cada posición.'
                      : isPositionEditor
                        ? 'Definí el rol, las habilidades requeridas y su ponderación.'
                        : currentPosition
                          ? 'Consultá los requisitos, editá el puesto o cargá CVs para esta posición.'
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
              onEdit={handleEditPosition}
              onUpdateStatus={(positionId, status) =>
                void handleUpdatePositionStatus(positionId, status)
              }
              statusUpdatingPositionId={positionStatusSavingId}
            />
          </section>
        )}

        {isCandidatesList && (
          <section className="page-surface">
            <CandidateBank
              candidates={savedCandidates}
              positions={savedPositions}
              loading={
                Boolean(session.user.id) &&
                candidatesLoadedForUserId !== session.user.id
              }
              loadingDocumentId={loadingCandidateDocumentId}
              error={candidateBankError}
              notice={candidateBankNotice}
              evaluationResult={candidateEvaluationResult}
              onRetry={() => {
                setCandidateBankError(null)
                setCandidateBankNotice(null)
                setCandidateEvaluationResult(null)
                setCandidatesLoadedForUserId(null)
                setCandidateListRefreshKey((current) => current + 1)
              }}
              onUseCandidate={(candidateId, candidateDocumentId, positionId) =>
                void handleUseSavedCandidate(
                  candidateId,
                  candidateDocumentId,
                  positionId,
                )
              }
              onCreatePosition={handleNewPosition}
            />
          </section>
        )}

        {isApplicationsPage && (
          <section className="page-surface">
            <ApplicationIntake
              positions={savedPositions}
              candidates={savedCandidates}
              session={session}
              requestedPositionId={
                new URLSearchParams(window.location.search).get('positionId') ?? ''
              }
              statusUpdatingPositionId={positionStatusSavingId}
              statusError={applicationStatusError}
              onSaved={() => {
                setCandidateBankError(null)
                setCandidateBankNotice(null)
                setCandidatesLoadedForUserId(null)
                setCandidateListRefreshKey((current) => current + 1)
              }}
            />
          </section>
        )}

        {isRankingPage && (
          <section className="page-surface">
            <PositionRanking
              positions={savedPositions}
              recruiterId={session.user.id}
              requestedPositionId={
                new URLSearchParams(window.location.search).get('positionId') ?? ''
              }
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
                onClick={() => {
                  savePositionRequested.current = true
                  void handleSavePosition()
                }}
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
                <div>
                  <dt>Porcentaje mínimo de aceptación</dt>
                  <dd data-testid="position-acceptance-threshold">
                    {currentPosition.requirements.acceptanceThreshold}%
                  </dd>
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
              <div className="position-detail-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/postulaciones?positionId=${encodeURIComponent(currentPosition.id)}`,
                    )
                  }
                  data-testid="open-position-applications"
                >
                  Cargar CVs y analizar
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
