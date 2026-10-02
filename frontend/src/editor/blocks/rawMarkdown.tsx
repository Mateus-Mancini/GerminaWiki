import { createReactBlockSpec } from '@blocknote/react';
import { RAW_BLOCK_TYPE } from '../codec/anchors';

/**
 * Markdown the block editor can't represent faithfully (raw HTML, unusual nesting), kept and edited as
 * text so nothing is dropped on save (spec FR-011, research R4). The codec writes `markdown` back as is.
 */
export const rawMarkdownBlock = createReactBlockSpec(
  {
    type: RAW_BLOCK_TYPE,
    propSchema: { markdown: { default: '' } },
    content: 'none'
  },
  {
    render: ({ block, editor }) => (
      <div className="raw-markdown" contentEditable={false}>
        <span className="raw-markdown__label" id={`raw-${block.id}`}>Markdown avançado</span>
        <textarea
          className="raw-markdown__source"
          aria-labelledby={`raw-${block.id}`}
          spellCheck={false}
          rows={Math.min(12, Math.max(2, block.props.markdown.split('\n').length))}
          value={block.props.markdown}
          readOnly={!editor.isEditable}
          // Keys typed here belong to the textarea, not to the block editor's shortcuts.
          onKeyDown={event => event.stopPropagation()}
          onChange={event => editor.updateBlock(block, { props: { markdown: event.target.value } })}
        />
      </div>
    )
  }
);
