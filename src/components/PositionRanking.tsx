import { useEffect, useState } from 'react'
import type { SavedPosition } from '../services/positions'
import {
  listRankedApplications,
  type RankedApplication,
} from '../services/applicationRanking'

interface PositionRankingProps {
  positions: SavedPosition[]
  recruiterId: string
  requestedPositionId: string
}

const formatDate = (value: string): string => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

export function PositionRanking({
  positions,
  recruiterId,
  requestedPositionId,
}: PositionRankingProps) {
  const [positionId, setPositionId] = useState(requestedPositionId)
  const [results, setResults] = useState<RankedApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!positionId) {
      return
    }

    let isActive = true
    void listRankedApplications(recruiterId, positionId)
      .then((ranking) => {
        if (isActive) {
          setResults(ranking)
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No se pudo cargar el ranking.',
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [positionId, recruiterId])

  return (
    <section className="position-ranking" aria-labelledby="position-ranking-title" data-testid="position-ranking">
      <div className="application-panel-heading">
        <div>
          <h2 id="position-ranking-title">Ranking de candidatos</h2>
          <p>
            Seleccioná una posición para ver cada candidato con su evaluación
            más reciente, ordenados de mayor a menor compatibilidad.
          </p>
        </div>
      </div>
      <label className="application-position-select">
        <span>Postulación / posición</span>
        <select
          value={positionId}
          onChange={(event) => {
            const nextPositionId = event.target.value
            setPositionId(nextPositionId)
            setError(null)
            setLoading(Boolean(nextPositionId))
            if (!nextPositionId) {
              setResults([])
            }
          }}
          disabled={!positions.length}
          data-testid="ranking-position"
        >
          <option value="">
            {positions.length ? 'Elegí una posición' : 'Primero creá una posición'}
          </option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.title}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert" data-testid="ranking-error">{error}</p>}
      {loading ? (
        <p role="status">Cargando evaluaciones...</p>
      ) : positionId && !error && results.length === 0 ? (
        <p role="status" className="application-empty-state">
          Todavía no hay CVs evaluados para esta posición.
        </p>
      ) : results.length > 0 ? (
        <ol className="ranking-list" data-testid="ranking-list">
          {results.map((result, index) => {
            const percentage = Math.round(
              (result.earnedPoints / result.totalPoints) * 100,
            )
            return (
              <li
                className="ranking-card"
                key={result.applicationId}
                data-testid="ranking-item"
              >
                <span className="ranking-place" aria-label={`Puesto ${index + 1}`}>
                  {index + 1}
                </span>
                <div className="ranking-candidate">
                  <h3>{result.candidateName}</h3>
                  <p>{result.fileName} · Evaluado {formatDate(result.evaluatedAt)}</p>
                  <details className="ranking-evaluation-details">
                    <summary>Ver fortalezas y brechas</summary>
                    <div className="ranking-evaluation-content">
                      <div>
                        <h4>Fortalezas</h4>
                        {result.strengths.length > 0 ? (
                          <ul>
                            {result.strengths.map((strength, strengthIndex) => (
                              <li key={`${strength}-${strengthIndex}`}>{strength}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No se registraron fortalezas.</p>
                        )}
                      </div>
                      <div>
                        <h4>Brechas</h4>
                        {result.gaps.length > 0 ? (
                          <ul>
                            {result.gaps.map((gap, gapIndex) => (
                              <li key={`${gap}-${gapIndex}`}>{gap}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No se registraron brechas.</p>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
                <div className="ranking-score">
                  <strong>{percentage}%</strong>
                  <span>{result.earnedPoints} / {result.totalPoints} puntos</span>
                  <span className={`status-badge ${result.verdict === 'Apto' ? 'status-abierta' : 'status-cancelada'}`}>
                    {result.verdict}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
