interface AuthScreenProps {
  configurationError: string | null
  error: string | null
  loading: boolean
  signingIn: boolean
  onSignIn: () => Promise<void>
}

export function AuthScreen({
  configurationError,
  error,
  loading,
  signingIn,
  onSignIn,
}: AuthScreenProps) {
  return (
    <main>
      <header className="app-header">
        <h1>Talentiq</h1>
      </header>

      <section aria-labelledby="auth-title">
        <h2 id="auth-title">Acceso de reclutador</h2>
        {loading ? (
          <p role="status">Verificando sesión...</p>
        ) : configurationError ? (
          <p role="alert" data-testid="auth-configuration-error">
            {configurationError}
          </p>
        ) : (
          <>
            <p>Iniciá sesión con Google para acceder a tu espacio privado.</p>
            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={signingIn}
              data-testid="google-sign-in"
            >
              {signingIn ? 'Conectando con Google...' : 'Continuar con Google'}
            </button>
          </>
        )}
        {error && (
          <p role="alert" data-testid="auth-error">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
