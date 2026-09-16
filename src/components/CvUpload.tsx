import type { ChangeEvent } from 'react'
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
  const handleTextChange = (text: string) => {
    onChange({
      text,
      fileName: null,
    })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const text =
      file.type === 'application/pdf'
        ? await extractPdfText(file)
        : await file.text()

    onChange({
      text,
      fileName: file.name,
    })
  }

  return (
    <section>
      <h2>Cargar CV</h2>

      <label htmlFor="candidate-resume-text">Pegá el texto del CV</label>
      <textarea
        id="candidate-resume-text"
        name="candidate-resume-text"
        value={value.text}
        onChange={(event) => handleTextChange(event.target.value)}
        data-testid="candidate-resume-text"
        rows={8}
      />

      <label htmlFor="candidate-resume-file">Seleccioná un archivo</label>
      <input
        id="candidate-resume-file"
        name="candidate-resume-file"
        type="file"
        accept=".txt,.pdf,text/plain,application/pdf"
        onChange={handleFileChange}
        data-testid="candidate-resume-file"
      />

      {value.fileName && (
        <p role="status" data-testid="candidate-resume-file-name">
          Archivo seleccionado: {value.fileName}
        </p>
      )}
    </section>
  )
}