import type { SavedPosition } from '../services/positions'

interface CvEvaluationPositionPickerProps {
  positions: SavedPosition[]
  loading: boolean
  error: string | null
  onCreate: () => void
  onSelect: (positionId: string) => void
}

export function CvEvaluationPositionPicker({
  positions,
  loading,
  error,
  onCreate,
  onSelect,
}: CvEvaluationPositionPickerProps) {
  return (
    <section
      className="position-list-panel"
      aria-labelledby="cv-evaluation-title"
    >
      <div className="position-list-heading">
        <div>
          <h2 id="cv-evaluation-title">Elegí un puesto para evaluar CVs</h2>
          <p>
            La evaluación se realiza siempre contra los requisitos de un puesto.
          </p>
        </div>
      </div>

      {loading ? (
        <p role="status" data-testid="cv-evaluation-loading">
          Cargando puestos...
        </p>
      ) : error ? (
        <p role="alert" data-testid="cv-evaluation-error">
          {error}
        </p>
      ) : positions.length === 0 ? (
        <div
          className="position-empty-state"
          data-testid="cv-evaluation-no-positions"
        >
          <span className="empty-state-mark" aria-hidden="true">
            P
          </span>
          <h3>Primero crea un puesto</h3>
          <p>
            Para evaluar CVs necesitás definir antes los requisitos de un puesto.
          </p>
          <button
            type="button"
            onClick={onCreate}
            data-testid="cv-evaluation-create-position"
          >
            Crear puesto
          </button>
        </div>
      ) : (
        <div
          className="position-table-wrap"
          data-testid="cv-evaluation-position-list"
        >
          <table className="position-table">
            <thead>
              <tr>
                <th scope="col">Puesto</th>
                <th scope="col">Seniority</th>
                <th scope="col">Habilidades</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id}>
                  <th scope="row">{position.title}</th>
                  <td>{position.requirements.seniority}</td>
                  <td>{position.requirements.skills.length}</td>
                  <td>
                    <span
                      className={`status-badge status-${position.status.toLowerCase().replaceAll(' ', '-')}`}
                    >
                      {position.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => onSelect(position.id)}
                      aria-label={`Evaluar CVs para ${position.title}`}
                      data-testid="cv-evaluation-select-position"
                    >
                      Evaluar CVs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
