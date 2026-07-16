import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownContent } from './markdown-preview.jsx'

export function renderMarkdownToHtml(content) {
  return renderToStaticMarkup(createElement(MarkdownContent, { content }))
}
