import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CandidateResume } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface CvUploadProps {
  value: CandidateResume
  onChange: (value: CandidateResume) => void
}

async function extractPdfText(file: File): Promise<string> {
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }
  return pages.join('\n')
}

export function CvUpload({ value, onChange }: CvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    const extension = file.name.toLowerCase().split('.').pop()
    if (extension !== 'pdf' || file.type !== 'application/pdf') {
      setFileError('Solo se aceptan archivos PDF.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('El archivo no puede superar los 5 MB.')
      return
    }

    setFileError(null)
    const text = await extractPdfText(file)
    onChange({ text, fileName: file.name })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await handleFile(file)
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) await handleFile(file)
  }

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  const handleChooseFile = () => inputRef.current?.click()

  return (
    <section aria-labelledby="cv-upload-title">
      <div className="step-heading"><span className="step-number">4</span><h2 id="cv-upload-title">Currículum</h2></div>
      <div
        className={`file-dropzone${isDragging ? ' file-dropzone-active' : ''}${value.fileName ? ' file-dropzone-loaded' : ''}`}
        role="button"
        tabIndex={0}
        onClick={handleChooseFile}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        data-testid="cv-dropzone"
      >
        <span className="file-dropzone-icon" aria-hidden="true">{value.fileName ? '✅' : '📄'}</span>
        {value.fileName ? <strong>{value.fileName}</strong> : <span>Arrastrá el CV acá o hacé clic para elegirlo</span>}
        <small>{value.fileName ? 'Clic para cambiar' : 'PDF · máx. 5 MB'}</small>
        <input ref={inputRef} id="candidate-resume-file" name="candidate-resume-file" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} data-testid="candidate-resume-file" hidden />
      </div>
      {fileError && <p role="alert" data-testid="candidate-resume-file-error">{fileError}</p>}
    </section>
  )
}
