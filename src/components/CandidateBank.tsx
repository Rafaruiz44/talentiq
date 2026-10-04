import { useMemo, useState } from 'react'
import type { SavedCandidate } from '../services/candidates'
import type { SavedPosition } from '../services/positions'

interface CandidateBankProps {
  candidates: SavedCandidate[]
  positions: SavedPosition[]
  loading: boolean
  loadingDocumentId: string | null
  error: string | null
  onRetry: () => void
  onUseCandidate: (
    candidateId: string,
    candidateDocumentId: string,
    positionId: string,
  ) => void
  onCreatePosition: () => void
}

const formatDate = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date)
}

export function CandidateBank({
  candidates,
  positions,
  loading,
  loadingDocumentId,
  error,
  onRetry,
  onUseCandidate,
  onCreatePosition,
}: CandidateBankProps) {
  const [search, setSearch] = useState('')
  const [positionId, setPositionId] = useState('')
  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-AR')
    if (!query) {
      return candidates
    }
    return candidates.filter(
      (candidate) =>
        candidate.name.toLocaleLowerCase('es-AR').includes(query) ||
        candidate.documents.some((document) =>
          document.fileName.toLocaleLowerCase('es-AR').includes(query),
        ),
    )
  }, [candidates, search])

  return (
    <section
      className="candidate-bank-panel"
      aria-labelledby="candidate-bank-title"
      data-testid="candidate-bank"
    >
      <div className="candidate-bank-heading">
        <div>
          <h2 id="candidate-bank-title">Banco de candidatos</h2>
          <p>
            Tus candidatos y CVs guardados, privados para tu cuenta. Elegí un
            puesto para reutilizar un CV sin volver a subirlo.
          </p>
        </div>
        <span className="candidate-count" data-testid="candidate-count">
          {candidates.length} {candidates.length === 1 ? 'candidato' : 'candidatos'}
        </span>
      </div>

      <div className="candidate-bank-tools">
        <label className="candidate-search">
          <span>Buscar candidato o archivo</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o nombre del CV"
            data-testid="candidate-search"
          />
        </label>
        <label className="candidate-position-select">
          <span>Puesto para evaluar</span>
          <select
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
            disabled={positions.length === 0}
            data-testid="candidate-position"
          >
            <option value="">
              {positions.length === 0
                ? 'Primero creá un puesto'
                : 'Elegí un puesto'}
            </option>
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title} — {position.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="candidate-bank-error" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p role="status">Cargando candidatos...</p>
      ) : error && candidates.length === 0 ? null : candidates.length === 0 ? (
        <div className="candidate-empty-state">
          <span className="empty-state-mark" aria-hidden="true">
            C
          </span>
          <h3>Tu banco está vacío</h3>
          <p>
            Cuando analices y guardes un CV desde un puesto, el candidato
            aparecerá acá para que puedas reutilizarlo.
          </p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <p className="candidate-no-results" role="status">
          No hay candidatos que coincidan con “{search.trim()}”.
        </p>
      ) : (
        <div className="candidate-card-list">
          {filteredCandidates.map((candidate) => {
            const usableDocuments = candidate.documents
              .filter((document) => document.status === 'processed')
              .sort(
                (left, right) =>
                  new Date(right.createdAt).getTime() -
                  new Date(left.createdAt).getTime(),
              )
            const latestDocument = usableDocuments[0]

            return (
              <article className="candidate-card" key={candidate.id}>
                <div className="candidate-card-identity">
                  <span className="candidate-avatar" aria-hidden="true">
                    {candidate.name.trim().charAt(0).toLocaleUpperCase('es-AR')}
                  </span>
                  <div>
                    <h3>{candidate.name}</h3>
                    <p>
                      {usableDocuments.length}{' '}
                      {usableDocuments.length === 1 ? 'CV procesado' : 'CVs procesados'}
                      {' · '}
                      Agregado {formatDate(candidate.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="candidate-card-document">
                  {latestDocument ? (
                    <>
                      <span className="candidate-document-label">
                        CV más reciente
                      </span>
                      <span className="candidate-document-name">
                        {latestDocument.fileName}
                      </span>
                      <span className="candidate-document-date">
                        {formatDate(latestDocument.createdAt)}
                      </span>
                    </>
                  ) : (
                    <span className="candidate-document-date">
                      No hay un CV procesado disponible.
                    </span>
                  )}
                </div>
                <div className="candidate-card-action">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      !latestDocument ||
                      !positionId ||
                      loadingDocumentId !== null
                    }
                    onClick={() =>
                      latestDocument &&
                      onUseCandidate(candidate.id, latestDocument.id, positionId)
                    }
                    data-testid={`use-candidate-${candidate.id}`}
                  >
                    {loadingDocumentId === latestDocument?.id
                      ? 'Cargando CV...'
                      : 'Usar en el puesto'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {positions.length === 0 && (
        <div className="candidate-create-position">
          <p>Para evaluar un candidato, primero necesitás tener un puesto.</p>
          <button type="button" onClick={onCreatePosition}>
            Crear puesto
          </button>
        </div>
      )}
    </section>
  )
}
