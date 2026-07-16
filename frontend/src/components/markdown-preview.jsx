import { forwardRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './markdown-preview.css'

const FONT_FAMILIES = {
  Inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Arial: 'Arial, sans-serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': 'Times, "Times New Roman", serif',
  Courier: 'Courier, "Courier New", monospace',
  Georgia: 'Georgia, "Times New Roman", serif',
  Verdana: 'Verdana, Arial, sans-serif',
}

function isMarkTag(node, closing = false) {
  if (node?.type !== 'html') return false
  const expected = closing ? '</mark>' : '<mark>'
  return node.value.trim().toLowerCase() === expected
}

function transformMarkNodes(node) {
  if (!Array.isArray(node?.children)) return

  node.children.forEach(transformMarkNodes)

  for (let index = 0; index < node.children.length; index += 1) {
    if (!isMarkTag(node.children[index])) continue

    const closingIndex = node.children.findIndex(
      (child, childIndex) => childIndex > index && isMarkTag(child, true)
    )
    if (closingIndex === -1) continue

    const markedChildren = node.children.slice(index + 1, closingIndex)
    node.children.splice(index, closingIndex - index + 1, {
      type: 'mark',
      data: { hName: 'mark' },
      children: markedChildren,
    })
  }
}

function remarkMark() {
  return transformMarkNodes
}

const markdownComponents = {
  a: ({ node, ...props }) => {
    void node
    return <a {...props} target="_blank" rel="noreferrer" />
  },
  input: ({ node, ...props }) => {
    void node
    return <input {...props} readOnly />
  },
}

export function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMark]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  )
}

function getPreviewStyle(settings) {
  const fontSize = Number(settings.font_size) || 12

  return {
    '--preview-font-family': FONT_FAMILIES[settings.font_family] || FONT_FAMILIES.Inter,
    '--preview-font-size': `${fontSize}pt`,
    '--preview-line-height': settings.line_height || 1.6,
    '--preview-text-color': settings.text_color || '#000000',
    '--preview-background-color': settings.background_color || '#ffffff',
    '--preview-margin-top': `${settings.margin_top || 0}pt`,
    '--preview-margin-right': `${settings.margin_right || 0}pt`,
    '--preview-margin-bottom': `${settings.margin_bottom || 0}pt`,
    '--preview-margin-left': `${settings.margin_left || 0}pt`,
    '--preview-h1-size': `${fontSize * 2}pt`,
    '--preview-h2-size': `${fontSize * 1.5}pt`,
    '--preview-heading-size': `${fontSize * 1.25}pt`,
  }
}

const MarkdownPreview = memo(forwardRef(function MarkdownPreview({ content, settings }, ref) {
  return (
    <div className="markdown-preview-scroll">
      <article ref={ref} className="markdown-preview-document" style={getPreviewStyle(settings)}>
        <MarkdownContent content={content} />
      </article>
    </div>
  )
}))

export default MarkdownPreview
