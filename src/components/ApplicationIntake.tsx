import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type {
  SavedPosition,
} from '../services/positions'
import { extractPdfText } from '../services/extractPdfText'
import { inferCandidateEvaluation } from '../services/inferCandidateEvaluation'
import {
  getSavedCandidateResume,
  saveCandidateDocument,
  updateCandidateContactInfo,
  type SavedCandidate,
} from '../services/candidates'
import { saveEvaluationRun } from '../services/evaluations'
import {
  listRankedApplications,
  type RankedApplication,
} from '../services/applicationRanking'
import type { CandidateResume } from '../types'

interface ApplicationIntakeProps {
  positions: SavedPosition[]
  candidates?: SavedCandidate[]
  session: Session
  onSaved: () => void
  requestedPositionId: string
  statusError?: string | null
  statusUpdatingPositionId?: string | null
}

interface FileProcessingState {
  file: File
  state: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
  isBelowThreshold?: boolean
}

interface CandidateProcessingState {
  candidateId: string
  candidateName: string
  fileName: string
  state: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
  isBelowThreshold?: boolean
}

const validatePdf = (file: File): string | null => {
  if (
    file.type !== 'application/pdf' ||
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    return 'El archivo debe ser un PDF válido.'
  }
  if (file.size === 0) {
    return 'El archivo está vacío.'
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'El archivo supera el límite de 5 MB.'
  }
  return null
}

const formatDate = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date)
}

export function ApplicationIntake({
  positions,
  candidates = [],
  session,
  onSaved,
  requestedPositionId,
  statusError,
  statusUpdatingPositionId,
}: ApplicationIntakeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [positionId, setPositionId] = useState(requestedPositionId)
  const [intakeMode, setIntakeMode] = useState<'upload' | 'existing'>('upload')
  const [files, setFiles] = useState<FileProcessingState[]>([])
  const [candidateProcessingList, setCandidateProcessingList] = useState<
    CandidateProcessingState[]
  >([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [evaluatedApplications, setEvaluatedApplications] = useState<
    RankedApplication[]
  >([])
  const [loadingEvaluated, setLoadingEvaluated] = useState(false)

  const selectedPosition = positions.find(
    (position) => position.id === positionId,
  )
  const isPositionClosed = selectedPosition?.status === 'Cerrada'
  const isStatusUpdating = statusUpdatingPositionId === positionId

  const loadEvaluatedCandidates = useCallback(
    async (targetPositionId: string) => {
      if (!targetPositionId || !session?.user?.id) {
        setEvaluatedApplications([])
        return
      }
      setLoadingEvaluated(true)
      try {
        const list = await listRankedApplications(
          session.user.id,
          targetPositionId,
        )
        setEvaluatedApplications(list)
      } catch {
        setEvaluatedApplications([])
      } finally {
        setLoadingEvaluated(false)
      }
    },
    [session, positions],
  )

  useEffect(() => {
    void loadEvaluatedCandidates(positionId)
  }, [positionId, loadEvaluatedCandidates])

  const evaluatedCandidateIds = useMemo(() => {
    return new Set(evaluatedApplications.map((app) => app.candidateId))
  }, [evaluatedApplications])

  // Candidatos que tienen al menos un documento CV procesado y disponible
  const usableCandidates = useMemo(() => {
    return candidates.filter((candidate) =>
      candidate.documents.some((document) => document.status === 'processed'),
    )
  }, [candidates])

  // Candidatos de la base que NO han sido evaluados aún para este puesto
  const candidatesNotEvaluated = useMemo(() => {
    return usableCandidates.filter(
      (candidate) => !evaluatedCandidateIds.has(candidate.id),
    )
  }, [usableCandidates, evaluatedCandidateIds])

  const filteredCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLocaleLowerCase('es-AR')
    if (!query) {
      return candidatesNotEvaluated
    }
    return candidatesNotEvaluated.filter(
      (candidate) =>
        candidate.name.toLocaleLowerCase('es-AR').includes(query) ||
        (candidate.email &&
          candidate.email.toLocaleLowerCase('es-AR').includes(query)) ||
        (candidate.phone &&
          candidate.phone.toLocaleLowerCase('es-AR').includes(query)) ||
        candidate.documents.some((document) =>
          document.fileName.toLocaleLowerCase('es-AR').includes(query),
        ),
    )
  }, [candidatesNotEvaluated, candidateSearch])

  const handleToggleCandidate = (candidateIdToToggle: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateIdToToggle)
        ? current.filter((id) => id !== candidateIdToToggle)
        : [...current, candidateIdToToggle],
    )
  }

  const handleSelectAllCandidates = () => {
    setSelectedCandidateIds(filteredCandidates.map((candidate) => candidate.id))
  }

  const handleDeselectAllCandidates = () => {
    setSelectedCandidateIds([])
  }

  const processFiles = async (selectedFiles: File[], selectedPositionId: string) => {
    const selectedPosition = positions.find(
      (position) => position.id === selectedPositionId,
    )
    if (!selectedPosition) {
      setFiles(
        selectedFiles.map((file) => ({
          file,
          state: 'failed',
          message: 'Elegí una postulación antes de cargar los CVs.',
        })),
      )
      return
    }
    if (selectedPosition.status === 'Cerrada') {
      setFiles(
        selectedFiles.map((file) => ({
          file,
          state: 'failed',
          message: 'Abrir postulación para cargar CVs',
        })),
      )
      return
    }

    setProcessing(true)
    const initialStates = selectedFiles.map(
      (file): FileProcessingState => ({ file, state: 'queued', message: 'En espera' }),
    )
    setFiles(initialStates)

    for (const [index, file] of selectedFiles.entries()) {
      const validationError = validatePdf(file)
      if (validationError) {
        setFiles((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, state: 'failed', message: validationError }
              : item,
          ),
        )
        continue
      }

      setFiles((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, state: 'processing', message: 'Extrayendo y analizando...' }
            : item,
        ),
      )

      try {
        const resumeText = await extractPdfText(file)
        if (!resumeText.trim()) {
          throw new Error('No se pudo extraer texto del PDF.')
        }

        const resume: CandidateResume = {
          text: resumeText,
          fileName: file.name,
          file,
        }
        const evaluation = await inferCandidateEvaluation(
          selectedPosition.requirements,
          resume,
          session.access_token,
          selectedPosition.id,
        )
        const savedCandidate = await saveCandidateDocument({
          accessToken: session.access_token,
          candidateName: evaluation.candidateName,
          candidateEmail: evaluation.candidateEmail,
          candidatePhone: evaluation.candidatePhone,
          extractedText: resumeText,
          file,
          recruiterId: session.user.id,
        })

        const savedEvaluation = await saveEvaluationRun({
          accessToken: session.access_token,
          candidateDocumentId: savedCandidate.candidateDocumentId,
          candidateId: savedCandidate.candidateId,
          evaluation,
          positionId: selectedPosition.id,
          requirements: selectedPosition.requirements,
          resumeText,
        })

        const percentage = Math.round(
          (savedEvaluation.earnedPoints / savedEvaluation.totalPoints) * 100,
        )
        const isBelowThreshold =
          percentage < selectedPosition.requirements.acceptanceThreshold

        setFiles((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  state: 'completed',
                  isBelowThreshold,
                  message: `${savedEvaluation.verdict} · ${percentage}% de compatibilidad`,
                }
              : item,
          ),
        )
        onSaved()
        void loadEvaluatedCandidates(positionId)
      } catch (error: unknown) {
        setFiles((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  state: 'failed',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'No se pudo procesar este CV.',
                }
              : item,
          ),
        )
      }
    }

    setProcessing(false)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const processExistingCandidates = async (
    candidateIdsToProcess: string[],
    selectedPositionId: string,
  ) => {
    const selectedPosition = positions.find(
      (position) => position.id === selectedPositionId,
    )
    if (!selectedPosition || selectedPosition.status === 'Cerrada') {
      return
    }

    const targetCandidates = usableCandidates.filter((candidate) =>
      candidateIdsToProcess.includes(candidate.id),
    )
    if (!targetCandidates.length) {
      return
    }

    setProcessing(true)
    const initialStates: CandidateProcessingState[] = targetCandidates.map(
      (candidate) => {
        const latestDoc = candidate.documents
          .filter((document) => document.status === 'processed')
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime(),
          )[0]

        return {
          candidateId: candidate.id,
          candidateName: candidate.name,
          fileName: latestDoc?.fileName ?? 'CV',
          state: 'queued',
          message: 'En espera',
        }
      },
    )
    setCandidateProcessingList(initialStates)

    for (const [index, candidate] of targetCandidates.entries()) {
      const usableDocuments = candidate.documents
        .filter((document) => document.status === 'processed')
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
      const latestDocument = usableDocuments[0]
      if (!latestDocument) {
        setCandidateProcessingList((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, state: 'failed', message: 'No hay CV disponible.' }
              : item,
          ),
        )
        continue
      }

      setCandidateProcessingList((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, state: 'processing', message: 'Analizando en esta posición...' }
            : item,
        ),
      )

      try {
        const resume = await getSavedCandidateResume({
          recruiterId: session.user.id,
          candidateId: candidate.id,
          candidateDocumentId: latestDocument.id,
        })

        const evaluation = await inferCandidateEvaluation(
          selectedPosition.requirements,
          {
            text: resume.text,
            fileName: resume.fileName,
            candidateId: candidate.id,
            candidateDocumentId: latestDocument.id,
          },
          session.access_token,
          selectedPosition.id,
        )

        const savedEvaluation = await saveEvaluationRun({
          accessToken: session.access_token,
          candidateDocumentId: latestDocument.id,
          candidateId: candidate.id,
          evaluation,
          positionId: selectedPosition.id,
          requirements: selectedPosition.requirements,
          resumeText: resume.text,
        })

        if (evaluation.candidateEmail || evaluation.candidatePhone) {
          void updateCandidateContactInfo({
            candidateId: candidate.id,
            email: evaluation.candidateEmail,
            phone: evaluation.candidatePhone,
          })
        }

        const percentage = Math.round(
          (savedEvaluation.earnedPoints / savedEvaluation.totalPoints) * 100,
        )
        const isBelowThreshold =
          percentage < selectedPosition.requirements.acceptanceThreshold

        setCandidateProcessingList((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  state: 'completed',
                  isBelowThreshold,
                  message: `${savedEvaluation.verdict} · ${percentage}% de compatibilidad`,
                }
              : item,
          ),
        )
        onSaved()
        void loadEvaluatedCandidates(positionId)
      } catch (error: unknown) {
        setCandidateProcessingList((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  state: 'failed',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Error al evaluar este candidato.',
                }
              : item,
          ),
        )
      }
    }

    setProcessing(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    if (!selectedFiles.length) {
      return
    }
    void processFiles(selectedFiles, positionId)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (processing || !positionId || isPositionClosed) {
      return
    }
    const selectedFiles = Array.from(event.dataTransfer.files)
    if (selectedFiles.length) {
      void processFiles(selectedFiles, positionId)
    }
  }

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!processing && positionId && !isPositionClosed) {
        inputRef.current?.click()
      }
    }
  }

  const isUploadDisabled = processing || !positionId || isPositionClosed
  const completedCount = files.filter((item) => item.state === 'completed').length
  const completedCandidatesCount = candidateProcessingList.filter(
    (item) => item.state === 'completed',
  ).length

  return (
    <section
      className="application-intake"
      aria-labelledby="application-intake-title"
      data-testid="application-intake"
    >
      <div className="application-position-toolbar">
        <label className="application-position-select">
          <span>Postulación / posición</span>
          <select
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            disabled={processing || isStatusUpdating}
            data-testid="application-position"
          >
            <option value="">Elegí una posición</option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title} — {position.status}
              </option>
            ))}
          </select>
        </label>
      </div>
      {statusError && (
        <p role="alert" data-testid="application-status-error">
          {statusError}
        </p>
      )}
      {isPositionClosed && (
        <p
          className="application-closed-message"
          role="status"
          data-testid="application-closed-message"
        >
          Abrir postulación para cargar CVs
        </p>
      )}

      {/* Selector de modo de postulación */}
      <div
        className="application-mode-selector"
        role="group"
        aria-label="Origen de los currículums"
        data-testid="application-mode-selector"
      >
        <button
          type="button"
          className={`application-mode-button ${intakeMode === 'upload' ? 'active' : ''}`}
          onClick={() => setIntakeMode('upload')}
          disabled={processing}
          data-testid="mode-upload"
        >
          <span aria-hidden="true">📄</span>
          <span>Cargar masivamente CVs</span>
        </button>
        <button
          type="button"
          className={`application-mode-button ${intakeMode === 'existing' ? 'active' : ''}`}
          onClick={() => setIntakeMode('existing')}
          disabled={processing}
          data-testid="mode-existing"
        >
          <span aria-hidden="true">👥</span>
          <span>
            Usar candidatos de la base ({candidatesNotEvaluated.length})
          </span>
        </button>
      </div>

      {intakeMode === 'upload' ? (
        <div className="application-cv-panel">
          <div className="step-heading">
            <h2 id="application-intake-title">Currículum</h2>
          </div>
          <div
            className={`application-file-dropzone${isDragging ? ' application-file-dropzone-active' : ''}${isUploadDisabled ? ' application-file-dropzone-disabled' : ''}`}
            role="button"
            tabIndex={isUploadDisabled ? -1 : 0}
            aria-disabled={isUploadDisabled}
            aria-label="Arrastrá los CVs acá o hacé clic para elegirlos. PDF, máximo 5 MB por archivo."
            onClick={() => {
              if (!isUploadDisabled) {
                inputRef.current?.click()
              }
            }}
            onKeyDown={handleDropzoneKeyDown}
            onDragOver={(event) => {
              event.preventDefault()
              if (!isUploadDisabled) {
                setIsDragging(true)
              }
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            data-testid="application-cv-dropzone"
          >
            <span className="application-file-dropzone-icon" aria-hidden="true">
              📄
            </span>
            <span>
              {isUploadDisabled && processing
                ? 'Se están procesando los CVs'
                : 'Arrastrá los CV acá o hacé clic para elegirlos'}
            </span>
            <small>PDF · máx. 5 MB por archivo</small>
            <input
              ref={inputRef}
              id="application-cv-files"
              name="application-cv-files"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={isUploadDisabled}
              onChange={handleFileChange}
              data-testid="application-cv-files"
              hidden
            />
          </div>
        </div>
      ) : (
        <div
          className="application-existing-panel"
          data-testid="application-existing-panel"
        >
          <div className="step-heading">
            <h2 id="application-intake-title">Candidatos guardados en la base</h2>
            <p>
              Seleccioná uno o más candidatos para evaluarlos en la posición
              elegida utilizando su CV ya procesado.
            </p>
          </div>

          {usableCandidates.length === 0 ? (
            <div className="application-empty-existing" role="status">
              <p>Todavía no tenés candidatos con CVs procesados en tu base.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIntakeMode('upload')}
              >
                Cargar CVs ahora
              </button>
            </div>
          ) : candidatesNotEvaluated.length === 0 ? (
            <div className="application-empty-existing" role="status">
              <p>Todos los candidatos con CV procesado ya fueron evaluados para este puesto.</p>
            </div>
          ) : (
            <>
              <div className="application-existing-toolbar">
                <input
                  type="search"
                  className="application-existing-search"
                  placeholder="Buscar por nombre, archivo o contacto..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  disabled={processing}
                  data-testid="existing-candidate-search"
                />
                <div className="application-existing-actions-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={handleSelectAllCandidates}
                    disabled={processing || filteredCandidates.length === 0}
                    data-testid="select-all-candidates"
                  >
                    Seleccionar todos ({filteredCandidates.length})
                  </button>
                  <button
                    type="button"
                    className="text-button deselect-button"
                    onClick={handleDeselectAllCandidates}
                    disabled={processing || selectedCandidateIds.length === 0}
                    data-testid="deselect-all-candidates"
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              <div
                className="application-existing-list"
                data-testid="existing-candidates-list"
              >
                {filteredCandidates.map((candidate) => {
                  const isChecked = selectedCandidateIds.includes(candidate.id)
                  const latestDocument = candidate.documents
                    .filter((doc) => doc.status === 'processed')
                    .sort(
                      (left, right) =>
                        new Date(right.createdAt).getTime() -
                        new Date(left.createdAt).getTime(),
                    )[0]

                  return (
                    <label
                      key={candidate.id}
                      className={`application-candidate-item ${isChecked ? 'selected' : ''}`}
                      data-testid={`existing-candidate-item-${candidate.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCandidate(candidate.id)}
                        disabled={processing}
                        data-testid={`select-candidate-${candidate.id}`}
                      />
                      <div className="application-candidate-details">
                        <div className="application-candidate-name-row">
                          <strong>{candidate.name}</strong>
                          {(candidate.email || candidate.phone) && (
                            <div className="candidate-inline-contact">
                              {candidate.email && (
                                <span className="contact-badge contact-email">
                                  ✉️ {candidate.email}
                                </span>
                              )}
                              {candidate.phone && (
                                <span className="contact-badge contact-phone">
                                  📞 {candidate.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {latestDocument && (
                          <span className="application-candidate-doc">
                            📄 {latestDocument.fileName} · {formatDate(latestDocument.createdAt)}
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="application-existing-submit-bar">
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    processing ||
                    !positionId ||
                    isPositionClosed ||
                    selectedCandidateIds.length === 0
                  }
                  onClick={() =>
                    void processExistingCandidates(selectedCandidateIds, positionId)
                  }
                  data-testid="evaluate-existing-candidates"
                >
                  {processing
                    ? 'Evaluando candidatos...'
                    : `Evaluar ${selectedCandidateIds.length} candidato${
                        selectedCandidateIds.length === 1 ? '' : 's'
                      } seleccionado${
                        selectedCandidateIds.length === 1 ? '' : 's'
                      }`}
                </button>
                {!positionId && (
                  <span className="submit-hint">
                    Elegí una posición arriba antes de evaluar.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!positions.length && (
        <p role="status">Primero creá una posición para cargar postulaciones.</p>
      )}

      {/* Progreso de carga de archivos */}
      {intakeMode === 'upload' && files.length > 0 && (
        <div className="application-processing-list" aria-live="polite">
          <p role="status" data-testid="application-progress">
            {processing
              ? `Procesados ${completedCount} de ${files.length} CVs; el actual puede demorar mientras se analiza.`
              : `Procesamiento terminado: ${completedCount} de ${files.length} CVs guardados.`}
          </p>
          <ul>
            {files.map((item, index) => (
              <li
                key={`${item.file.name}-${index}`}
                className={`application-file-status application-file-${item.state}`}
                data-testid={`application-file-${index}`}
              >
                <strong>{item.file.name}</strong>
                <span
                  className={item.isBelowThreshold ? 'compatibility-below-threshold' : undefined}
                >
                  {item.state === 'queued'
                    ? 'En espera'
                    : item.state === 'processing'
                      ? 'Procesando'
                      : item.state === 'completed'
                        ? item.message
                        : `Error: ${item.message}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progreso de evaluación de candidatos existentes */}
      {intakeMode === 'existing' && candidateProcessingList.length > 0 && (
        <div
          className="application-processing-list"
          aria-live="polite"
          data-testid="existing-candidates-progress-list"
        >
          <p role="status" data-testid="existing-candidates-progress">
            {processing
              ? `Procesando ${completedCandidatesCount} de ${candidateProcessingList.length} candidatos...`
              : `Evaluación terminada: ${completedCandidatesCount} de ${candidateProcessingList.length} candidatos evaluados.`}
          </p>
          <ul>
            {candidateProcessingList.map((item, index) => (
              <li
                key={`${item.candidateId}-${index}`}
                className={`application-file-status application-file-${item.state}`}
                data-testid={`existing-candidate-status-${index}`}
              >
                <strong>
                  {item.candidateName} ({item.fileName})
                </strong>
                <span
                  className={item.isBelowThreshold ? 'compatibility-below-threshold' : undefined}
                >
                  {item.state === 'queued'
                    ? 'En espera'
                    : item.state === 'processing'
                      ? 'Procesando'
                      : item.state === 'completed'
                        ? item.message
                        : `Error: ${item.message}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidatos ya evaluados para el puesto seleccionado */}
      {positionId && (
        <div
          className="application-evaluated-section"
          data-testid="application-evaluated-section"
        >
          <div className="step-heading">
            <h3 id="evaluated-candidates-heading">
              Candidatos ya evaluados para este puesto ({evaluatedApplications.length})
            </h3>
            <p>
              Listado de todos los candidatos que ya cuentan con una evaluación registrada en este puesto.
            </p>
          </div>

          {loadingEvaluated ? (
            <p role="status">Cargando candidatos evaluados...</p>
          ) : evaluatedApplications.length === 0 ? (
            <p className="empty-state-text" role="status" data-testid="no-evaluated-candidates">
              Aún no hay candidatos evaluados para este puesto.
            </p>
          ) : (
            <ul
              className="application-evaluated-list"
              aria-labelledby="evaluated-candidates-heading"
              data-testid="application-evaluated-list"
            >
              {evaluatedApplications.map((app) => {
                const threshold = selectedPosition?.requirements.acceptanceThreshold ?? 70
                const percentage =
                  app.totalPoints > 0
                    ? Math.round((app.earnedPoints / app.totalPoints) * 100)
                    : 0
                const isBelow = percentage < threshold
                return (
                  <li
                    key={app.applicationId}
                    className="application-evaluated-item"
                    data-testid={`evaluated-candidate-item-${app.applicationId}`}
                  >
                    <div className="application-evaluated-identity">
                      <strong>{app.candidateName}</strong>
                      <span className="application-evaluated-doc">
                        📄 {app.fileName} · {formatDate(app.evaluatedAt)}
                        {(app.candidateEmail || app.candidatePhone) && (
                          <>
                            {app.candidateEmail && ` · ✉️ ${app.candidateEmail}`}
                            {app.candidatePhone && ` · 📞 ${app.candidatePhone}`}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="application-evaluated-score">
                      <span className={isBelow ? 'compatibility-below-threshold' : undefined}>
                        {percentage}% de compatibilidad
                      </span>
                      <span
                        className={`verdict-tag ${
                          app.verdict === 'Apto' ? 'verdict-pass' : 'verdict-fail'
                        }`}
                      >
                        {app.verdict}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
