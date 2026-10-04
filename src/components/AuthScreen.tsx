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
    <main className="auth-screen">
      <header className="auth-brand">
        <span className="app-brand-mark" aria-hidden="true">
          T
        </span>
        <h1>Talentiq</h1>
      </header>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-mark" aria-hidden="true">
          T
        </div>
        <p className="auth-eyebrow">ESPACIO DE TRABAJO</p>
        <h2 id="auth-title">Acceso de reclutador</h2>
        {loading ? (
          <p role="status">Verificando sesión...</p>
        ) : configurationError ? (
          <p role="alert" data-testid="auth-configuration-error">
            {configurationError}
          </p>
        ) : (
          <>
            <p className="auth-description">
              Ingresá para gestionar tus búsquedas y evaluar currículums.
            </p>
            <button
              className="google-sign-in-button"
              type="button"
              onClick={() => void onSignIn()}
              disabled={signingIn}
              data-testid="google-sign-in"
            >
              {!signingIn && (
                <svg
                  className="google-sign-in-icon"
                  data-testid="google-sign-in-icon"
                  aria-hidden="true"
                  viewBox="0 0 48 48"
                >
                  <path
                    fill="#4285F4"
                    d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"
                  />
                </svg>
              )}
              {signingIn ? 'Conectando con Google...' : 'Ingresar con Google'}
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
