import type { ChangeEvent } from 'react'
import type { CandidateResume } from '../types'

interface CvUploadProps {
  value: CandidateResume
  onChange: (value: CandidateResume) => void
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

    onChange({
      text: await file.text(),
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
        accept=".txt,text/plain"
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