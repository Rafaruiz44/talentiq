import type { CandidateEvaluation } from '../types'

interface EvaluationResultsProps {
  evaluation: CandidateEvaluation
}

export function EvaluationResults({ evaluation }: EvaluationResultsProps) {
  return (
    <section aria-labelledby="evaluation-results-title">
      <h2 id="evaluation-results-title">Resultados del análisis</h2>

      <p data-testid="match-score">
        Porcentaje de afinidad: <strong>{evaluation.matchScore}%</strong>
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