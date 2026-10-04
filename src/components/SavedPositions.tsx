import type { SavedPosition } from '../services/positions'

interface SavedPositionsProps {
  positions: SavedPosition[]
  selectedPositionId: string | null
  loading: boolean
  saving: boolean
  canSave: boolean
  onSelect: (positionId: string) => void
  onNew: () => void
  onSave: () => void
}

export function SavedPositions({
  positions,
  selectedPositionId,
  loading,
  saving,
  canSave,
  onSelect,
  onNew,
  onSave,
}: SavedPositionsProps) {
  return (
    <section aria-labelledby="saved-positions-title">
      <h2 id="saved-positions-title">Puestos guardados</h2>
      <label htmlFor="saved-positions">Seleccionar puesto</label>
      <select
        id="saved-positions"
        value={selectedPositionId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        disabled={loading || positions.length === 0}
        data-testid="saved-positions"
      >
        <option value="">
          {loading
            ? 'Cargando puestos...'
            : positions.length === 0
              ? 'Todavía no hay puestos guardados'
              : 'Elegí un puesto guardado'}
        </option>
        {positions.map((position) => (
          <option key={position.id} value={position.id}>
            {position.title} — {position.status}
          </option>
        ))}
      </select>
      <div className="field-row">
        <button
          type="button"
          onClick={onNew}
          disabled={loading || saving}
          data-testid="new-position"
        >
          Nuevo puesto
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || loading || saving}
          data-testid="save-position"
        >
          {saving
            ? 'Guardando...'
            : selectedPositionId
              ? 'Actualizar puesto'
              : 'Guardar puesto'}
        </button>
      </div>
    </section>
  )
}
