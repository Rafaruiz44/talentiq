interface LinkedInRequirementsImportProps {
  sourceUrl: string
  loading: boolean
  onSourceUrlChange: (sourceUrl: string) => void
  onImport: () => Promise<void>
}

export function LinkedInRequirementsImport({
  sourceUrl,
  loading,
  onSourceUrlChange,
  onImport,
}: LinkedInRequirementsImportProps) {
  return (
    <section aria-labelledby="linkedin-import-title">
      <h2 id="linkedin-import-title">Importar requisitos desde LinkedIn</h2>

      <label htmlFor="linkedin-job-url">Link de la oferta</label>
      <input
        id="linkedin-job-url"
        name="linkedin-job-url"
        type="url"
        value={sourceUrl}
        onChange={(event) => onSourceUrlChange(event.target.value)}
        placeholder="https://www.linkedin.com/jobs/view/..."
        data-testid="linkedin-job-url"
      />

      <button
        type="button"
        onClick={onImport}
        disabled={loading || sourceUrl.trim().length === 0}
        data-testid="import-linkedin-requirements"
      >
        {loading ? 'Importando requisitos...' : 'Importar requisitos'}
      </button>
    </section>
  )
}