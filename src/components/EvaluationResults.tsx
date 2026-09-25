import type { CandidateEvaluation } from '../types'
import { APPROVAL_THRESHOLD_PERCENTAGE } from '../services/inferCandidateEvaluation'

interface EvaluationResultsProps {
  evaluation: CandidateEvaluation
}

export function EvaluationResults({ evaluation }: EvaluationResultsProps) {
  const scorePercentage = Math.round(
    (evaluation.earnedPoints / evaluation.totalPoints) * 100,
  )

  return (
    <section aria-labelledby="evaluation-results-title">
      <h2 id="evaluation-results-title">Resultados del análisis</h2>

      <p data-testid="match-score">
        Puntaje obtenido: <strong>{scorePercentage}%</strong>
      </p>
      <p data-testid="approval-threshold">
        Porcentaje mínimo para aprobar: <strong>{APPROVAL_THRESHOLD_PERCENTAGE}%</strong>
      </p>
      <p data-testid="evaluation-verdict">
        Veredicto:{' '}
        <strong className={`verdict-${evaluation.verdict === 'Apto' ? 'approved' : 'rejected'}`}>
          {evaluation.verdict}
        </strong>
      </p>

      <h3>Fortalezas</h3>
      <ul data-testid="evaluation-strengths">
        {evaluation.strengths.map((strength) => (
          <li key={strength}>{strength}</li>
        ))}
      </ul>

      <h3>Brechas o habilidades faltantes</h3>
      <ul data-testid="evaluation-gaps">
        {evaluation.gaps.map((gap) => (
          <li key={gap}>{gap}</li>
        ))}
      </ul>
    </section>
  )
}