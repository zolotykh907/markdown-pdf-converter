import { useEffect, useId, useState } from 'react'
import { renderMermaidSvg } from './mermaid-renderer.js'

function getRenderId(id) {
  return `mermaid-preview-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

export default function MermaidDiagram({ chart, sourceLine }) {
  const id = useId()
  const [state, setState] = useState({ status: 'loading', svg: '', error: '' })

  useEffect(() => {
    let cancelled = false

    setState({ status: 'loading', svg: '', error: '' })
    void renderMermaidSvg(chart, getRenderId(id))
      .then(({ svg }) => {
        if (!cancelled) setState({ status: 'ready', svg, error: '' })
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: 'error',
            svg: '',
            error: error instanceof Error ? error.message : 'Не удалось построить диаграмму.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, id])

  const sourcePosition = sourceLine ? { 'data-source-line': sourceLine } : {}

  if (state.status === 'loading') {
    return (
      <div className="mermaid-diagram mermaid-diagram-loading" {...sourcePosition}>
        Построение Mermaid-диаграммы…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mermaid-diagram mermaid-diagram-error" {...sourcePosition}>
        <p>Не удалось построить Mermaid-диаграмму: {state.error}</p>
        <pre><code>{chart}</code></pre>
      </div>
    )
  }

  return (
    <div
      className="mermaid-diagram"
      role="img"
      aria-label="Mermaid-диаграмма"
      {...sourcePosition}
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}
