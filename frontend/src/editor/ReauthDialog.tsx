import { useId, useState, type FormEvent } from 'react';
import { ApiRequestError } from '../services/backend-api';

/**
 * Sign in again without leaving the editor when the session expires during a save (spec US3 scenario 3).
 * `onSignIn` signs in and retries the save; it throws when either fails.
 */
export function ReauthDialog({ onSignIn, onCancel }: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await onSignIn(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''));
    } catch (failure) {
      setError(failure instanceof ApiRequestError && failure.status === 401
        ? 'E-mail ou senha inválidos.'
        : 'Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-editor__backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} className="page-editor__dialog">
        <h2 id={`${id}-title`}>Sua sessão expirou</h2>
        <p id={`${id}-text`}>Entre novamente para salvar. Seu texto continua no editor e guardado neste dispositivo.</p>
        <form className="reauth" onSubmit={event => void submit(event)}>
          <label htmlFor={`${id}-email`}>E-mail</label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="username" required autoFocus />
          <label htmlFor={`${id}-password`}>Senha</label>
          <input id={`${id}-password`} name="password" type="password" autoComplete="current-password" required />
          {error && <p role="alert" className="page-editor__field-error">{error}</p>}
          <div className="page-editor__actions">
            <button type="button" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="page-editor__save" disabled={busy}>{busy ? 'Entrando…' : 'Entrar e salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
