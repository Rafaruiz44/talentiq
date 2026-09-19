import { useState, type ChangeEvent, type DragEvent } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { CandidateResume } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

interface CvUploadProps {
  value: CandidateResume
  onChange: (value: CandidateResume) => void
}

async function extractPdfText(file: File): Promise<string> {
  const document = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
  }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n')
}

export function CvUpload({ value, onChange }: CvUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = async (file: File) => {
    const text =
      file.type === 'application/pdf'
        ? await extractPdfText(file)
        : await file.text()

    onChange({
      text,
      fileName: file.name,
    })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file) {
      await handleFile(file)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]

    if (file) {
      await handleFile(file)
    }
  }

  return (
    <section>
      <h2>Cargar CV</h2>

      <label
        htmlFor="candidate-resume-file"
        className={`file-dropzone${isDragging ? ' file-dropzone-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span>Seleccioná un archivo o arrastralo acá</span>
        <input
          id="candidate-resume-file"
          name="candidate-resume-file"
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          onChange={handleFileChange}
          data-testid="candidate-resume-file"
        />
      </label>

      {value.fileName && (
        <p role="status" data-testid="candidate-resume-file-name">
          Archivo seleccionado: {value.fileName}
        </p>
      )}
    </section>
  )
}