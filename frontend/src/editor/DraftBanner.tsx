import type { Draft } from './drafts';

const when = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
});

function describe(savedAt: string) {
  const parts = Object.fromEntries(when.formatToParts(new Date(savedAt)).map(part => [part.type, part.value]));
  return `${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`;
}

/** Offers a draft kept on this device (spec US3 scenario 2). */
export function DraftBanner({ draft, others, onRestore, onDiscard }: {
  draft: Draft;
  others: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const more = others > 0 ? ` e mais ${others} ${others === 1 ? 'rascunho' : 'rascunhos'}` : '';
  return (
    <section className="draft-banner" aria-label="Rascunho não salvo">
      <p>Você tem um rascunho não salvo desta página, de {describe(draft.savedAt)}{more}.</p>
      <div className="page-editor__actions">
        <button type="button" onClick={onDiscard}>Descartar rascunho</button>
        <button type="button" className="page-editor__save" onClick={onRestore}>Restaurar rascunho</button>
      </div>
    </section>
  );
}
