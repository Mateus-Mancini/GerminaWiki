import { diffLines } from 'diff';
import { useId, useState } from 'react';
import type { RemotePage } from '../services/backend-api';
import { parseAnchor } from './codec/anchors';

export type ConflictScreenProps = {
  mine: { title: string; content: string };
  published: RemotePage;
  lastEditor: { name: string; at: string } | null;
  onDiscard: () => void;
  onContinue: () => void;
  /** Called only after the member confirms that the published changes will be lost. */
  onReplace: () => void;
};

// The school is in Brazil; a fixed zone keeps times the same for everyone (and for tests on UTC machines).
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : time.format(date);
}

type Line = { text: string; change: 'same' | 'added' | 'removed' };

/** Line diff of the two Markdown texts, without anchor lines (they are bookkeeping, not content). */
function diff(published: string, mine: string): { mine: Line[]; published: Line[] } {
  const result = { mine: [] as Line[], published: [] as Line[] };
  for (const part of diffLines(published, mine)) {
    const lines = part.value.replace(/\n$/, '').split('\n').filter(line => !parseAnchor(line));
    for (const text of lines) {
      if (!part.removed) result.mine.push({ text, change: part.added ? 'added' : 'same' });
      if (!part.added) result.published.push({ text, change: part.removed ? 'removed' : 'same' });
    }
  }
  return result;
}

function Version({ label, lines }: { label: string; lines: Line[] }) {
  return (
    <section className="conflict__version" aria-label={label}>
      <h3>{label}</h3>
      <div className="conflict__lines">
        {lines.map((line, index) => {
          const text = <span className="conflict__text">{line.text || ' '}</span>;
          if (line.change === 'added') return <ins key={index}>{text}<span className="visually-hidden"> (só na sua versão)</span></ins>;
          if (line.change === 'removed') return <del key={index}>{text}<span className="visually-hidden"> (só na versão publicada)</span></del>;
          return <div key={index}>{text}</div>;
        })}
      </div>
    </section>
  );
}

/** Shown when a save is rejected because the page changed (spec US2, research R6). */
export function ConflictScreen({ mine, published, lastEditor, onDiscard, onContinue, onReplace }: ConflictScreenProps) {
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const lines = diff(published.content, mine.content);
  const at = lastEditor ? formatTime(lastEditor.at) : '';
  const who = lastEditor ? `Atualizada por ${lastEditor.name}${at ? ` às ${at}` : ''}.` : 'Outra pessoa salvou uma nova versão.';
  const lost = lastEditor ? `As alterações de ${lastEditor.name}${at ? ` (${at})` : ''} serão perdidas.` : 'As alterações da versão publicada serão perdidas.';

  return (
    <div className="conflict">
      <header className="conflict__header">
        <h2>Esta página mudou enquanto você editava</h2>
        <p>{who} Seu texto foi mantido: escolha como continuar.</p>
        <div className="conflict__actions">
          <button type="button" onClick={onDiscard}>Descartar minhas alterações</button>
          <button type="button" className="conflict__primary" onClick={onContinue}>Continuar editando sobre a versão publicada</button>
          <button type="button" className="conflict__danger" onClick={() => setConfirming(true)}>Substituir pela minha versão</button>
        </div>
      </header>

      <div className="conflict__versions">
        <Version label="Sua versão" lines={lines.mine} />
        <Version label="Versão publicada" lines={lines.published} />
      </div>

      {confirming && (
        <div className="page-editor__backdrop">
          <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} className="page-editor__dialog">
            <h2 id={`${id}-title`}>Substituir a versão publicada?</h2>
            <p id={`${id}-text`}>{lost} Esta ação não pode ser desfeita.</p>
            <div className="page-editor__actions">
              <button type="button" autoFocus onClick={() => setConfirming(false)}>Cancelar</button>
              <button type="button" className="page-editor__danger" onClick={() => { setConfirming(false); onReplace(); }}>Substituir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
