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

const MARK_OPENING_PATTERN = /^<mark(?:\s+style\s*=\s*(["'])\s*background-color\s*:\s*(#[0-9a-f]{6})\s*;?\s*\1)?\s*>$/i

function getMarkColor(node) {
  if (node?.type !== 'html') return null
  const match = node.value.trim().match(MARK_OPENING_PATTERN)
  if (!match) return null
  return match[2]?.toLowerCase() || ''
}

function isClosingMarkTag(node) {
  return node?.type === 'html' && node.value.trim().toLowerCase() === '</mark>'
}

function transformMarkNodes(node) {
  if (!Array.isArray(node?.children)) return

  node.children.forEach(transformMarkNodes)

  for (let index = 0; index < node.children.length; index += 1) {
    const color = getMarkColor(node.children[index])
    if (color === null) continue

    const closingIndex = node.children.findIndex(
      (child, childIndex) => childIndex > index && isClosingMarkTag(child)
    )
    if (closingIndex === -1) continue

    const markedChildren = node.children.slice(index + 1, closingIndex)
    node.children.splice(index, closingIndex - index + 1, {
      type: 'mark',
      data: {
        hName: 'mark',
        ...(color && { hProperties: { 'data-highlight-color': color } }),
      },
      children: markedChildren,
    })
  }
}

function remarkMark() {
  return transformMarkNodes
}

function createSourceElement(tagName) {
  return function SourceElement({ node, ...props }) {
    const line = node?.position?.start?.line
    const Tag = tagName
    return <Tag {...props} {...(line ? { 'data-source-line': line } : {})} />
  }
}

const sourceComponents = Object.fromEntries(
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'tr', 'hr']
    .map((tagName) => [tagName, createSourceElement(tagName)])
)

const markdownComponents = {
  a: ({ node, ...props }) => {
    void node
    return <a {...props} target="_blank" rel="noreferrer" />
  },
  input: ({ node, ...props }) => {
    void node
    return <input {...props} readOnly />
  },
  mark: ({ node, ...props }) => {
    const color = node?.properties?.['data-highlight-color']
    return <mark {...props} style={color ? { backgroundColor: color } : undefined} />
  },
}

const previewMarkdownComponents = {
  ...sourceComponents,
  ...markdownComponents,
}

export function MarkdownContent({ content, sourcePositions = false }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMark]}
      components={sourcePositions ? previewMarkdownComponents : markdownComponents}
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
    '--preview-highlight-color': settings.highlight_color || '#fff176',
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
    <div ref={ref} className="markdown-preview-scroll">
      <article className="markdown-preview-document" style={getPreviewStyle(settings)}>
        <MarkdownContent content={content} sourcePositions />
      </article>
    </div>
  )
}))

export default MarkdownPreview
