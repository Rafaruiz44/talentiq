import type { SavedPosition } from '../services/positions'

interface PositionListProps {
  positions: SavedPosition[]
  loading: boolean
  onCreate: () => void
  onOpen: (positionId: string) => void
}

export function PositionList({
  positions,
  loading,
  onCreate,
  onOpen,
}: PositionListProps) {
  return (
    <section className="position-list-panel" aria-labelledby="position-list-title">
      <div className="position-list-heading">
        <div>
          <h2 id="position-list-title">Tus puestos</h2>
          <p>Seleccioná una posición para revisar sus requisitos y evaluar CVs.</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          data-testid="create-position"
        >
          Crear puesto
        </button>
      </div>

      {loading ? (
        <p role="status">Cargando puestos...</p>
      ) : positions.length === 0 ? (
        <div className="position-empty-state">
          <span className="empty-state-mark" aria-hidden="true">
            P
          </span>
          <h3>Aún no tenés puestos</h3>
          <p>Creá tu primera posición para definir los requisitos del rol.</p>
          <button type="button" onClick={onCreate}>
            Crear primer puesto
          </button>
        </div>
      ) : (
        <div className="position-table-wrap">
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
                  <th scope="row">
                    <button
                      type="button"
                      className="position-title-link"
                      onClick={() => onOpen(position.id)}
                    >
                      {position.title}
                    </button>
                  </th>
                  <td>{position.requirements.seniority}</td>
                  <td>{position.requirements.skills.length}</td>
                  <td>
                    <span className={`status-badge status-${position.status.toLowerCase().replaceAll(' ', '-')}`}>
                      {position.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => onOpen(position.id)}
                      aria-label={`Abrir ${position.title}`}
                    >
                      Ver puesto
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
