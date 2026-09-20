import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownContent } from './markdown-preview.jsx'
import { renderMermaidSvg } from './mermaid-renderer.js'

function createExportDiagramId(index) {
  return `mermaid-export-${Date.now()}-${index}`
}

function renderDiagramError(container, chart) {
  const message = document.createElement('p')
  message.textContent = 'Не удалось построить Mermaid-диаграмму.'
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = chart
  pre.append(code)

  container.classList.add('mermaid-diagram-error')
  container.replaceChildren(message, pre)
}

export async function renderMarkdownToHtml(content) {
  const markup = renderToStaticMarkup(createElement(MarkdownContent, { content, forExport: true }))
  const container = document.createElement('div')
  container.innerHTML = markup
  const diagrams = Array.from(container.querySelectorAll('[data-mermaid-source]'))

  for (const [index, diagram] of diagrams.entries()) {
    const chart = diagram.dataset.mermaidSource
    if (!chart) continue

    try {
      const { svg } = await renderMermaidSvg(chart, createExportDiagramId(index))
      diagram.replaceChildren()
      diagram.insertAdjacentHTML('afterbegin', svg)
      diagram.removeAttribute('data-mermaid-source')
    } catch {
      renderDiagramError(diagram, chart)
    }
  }

  return container.innerHTML
}
