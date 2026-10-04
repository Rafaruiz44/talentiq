import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { SavedPosition } from '../services/positions'
import { extractPdfText } from '../services/extractPdfText'
import { inferCandidateEvaluation } from '../services/inferCandidateEvaluation'
import { saveCandidateDocument } from '../services/candidates'
import { saveEvaluationRun } from '../services/evaluations'
import type { CandidateResume } from '../types'

interface ApplicationIntakeProps {
  positions: SavedPosition[]
  session: Session
  onSaved: () => void
  requestedPositionId: string
}

interface FileProcessingState {
  file: File
  state: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
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

export function ApplicationIntake({
  positions,
  session,
  onSaved,
  requestedPositionId,
}: ApplicationIntakeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [positionId, setPositionId] = useState(requestedPositionId)
  const [files, setFiles] = useState<FileProcessingState[]>([])
  const [processing, setProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

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
          extractedText: resumeText,
          file,
          recruiterId: session.user.id,
        })

        if (!evaluation.reusedExistingEvaluation) {
          await saveEvaluationRun({
            accessToken: session.access_token,
            candidateDocumentId: savedCandidate.candidateDocumentId,
            candidateId: savedCandidate.candidateId,
            evaluation,
            positionId: selectedPosition.id,
            requirements: selectedPosition.requirements,
            resumeText,
          })
        }

        setFiles((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  state: 'completed',
                  message: `${evaluation.verdict} · ${Math.round(
                    (evaluation.earnedPoints / evaluation.totalPoints) * 100,
                  )}% de compatibilidad`,
                }
              : item,
          ),
        )
        onSaved()
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
    if (processing || !positionId) {
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
      if (!processing && positionId) {
        inputRef.current?.click()
      }
    }
  }

  const isUploadDisabled = processing || !positionId
  const completedCount = files.filter((item) => item.state === 'completed').length

  return (
    <section className="application-intake" aria-labelledby="application-intake-title" data-testid="application-intake">
      <label className="application-position-select">
        <span>Postulación / posición</span>
        <select
          value={positionId}
          onChange={(event) => setPositionId(event.target.value)}
          disabled={processing}
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
      {!positions.length && (
        <p role="status">Primero creá una posición para cargar postulaciones.</p>
      )}
      {files.length > 0 && (
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
                <span>
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
    </section>
  )
}
