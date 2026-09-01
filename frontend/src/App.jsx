import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { SearchQuery, findNext, findPrevious, replaceAll, replaceNext, search as searchExtension, setSearchQuery } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import MarkdownPreview from '@/components/markdown-preview.jsx'
import { Download, FileText, Upload, Bold, Italic, Highlighter, Heading1, Heading2, List, ListOrdered, Code, Quote, Table, Undo2, Redo2, RefreshCw, Loader2, Search as SearchIcon, ChevronUp, ChevronDown, X } from 'lucide-react'
import './App.css'

const IS_ELECTRON = Boolean(window.electron?.isElectron)
const LARGE_DOCUMENT_THRESHOLD = 50000
const PREVIEW_DEBOUNCE_MS = 900
const LARGE_PREVIEW_DEBOUNCE_MS = 2500
const HTML_PREVIEW_DEBOUNCE_MS = 120
const LARGE_HTML_PREVIEW_DEBOUNCE_MS = 800
const EDITOR_EXTENSIONS = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  searchExtension({ top: true })
]
const EDITOR_BASIC_SETUP = {
  lineNumbers: true,
  highlightActiveLine: true,
  foldGutter: false,
  dropCursor: false,
  allowMultipleSelections: false,
  indentOnInput: true,
  searchKeymap: false,
}
const EDITOR_STYLE = { height: '100%', fontSize: '13px' }
const HIGHLIGHT_COLORS = [
  '#fff176',
  '#ffcc80',
  '#ef9a9a',
  '#f8bbd0',
  '#ce93d8',
  '#90caf9',
  '#80deea',
  '#a5d6a7',
]

function getSearchStats(view, query) {
  if (!query.search) return { current: 0, total: 0, error: null }
  if (!query.valid) return { current: 0, total: 0, error: 'Некорректное регулярное выражение' }

  const selection = view.state.selection.main
  let current = 0
  let total = 0

  for (const match of query.getCursor(view.state)) {
    total += 1
    if (match.from === selection.from && match.to === selection.to) current = total
  }

  return { current, total, error: null }
}

function getPreviewTarget(anchors, sourceLine) {
  if (!anchors.length) return 0

  let low = 0
  let high = anchors.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (anchors[middle].line <= sourceLine) low = middle + 1
    else high = middle - 1
  }

  const current = anchors[Math.max(0, high)]
  const next = anchors[Math.min(anchors.length - 1, Math.max(0, high) + 1)]
  if (current === next || next.line === current.line) return current.top

  const progress = Math.min(1, Math.max(0, (sourceLine - current.line) / (next.line - current.line)))
  return current.top + (next.top - current.top) * progress
}

function HighlightColorPicker({ color, onSelect, title = 'Выделить маркером' }) {
  const [open, setOpen] = useState(false)
  const colors = [color, ...HIGHLIGHT_COLORS.filter((item) => item !== color)]

  const selectColor = (selectedColor) => {
    onSelect(selectedColor)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          style={{ color }}
          title={title}
          aria-label={title}
        >
          <Highlighter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((item, index) => (
            <button
              key={item}
              type="button"
              className="h-7 w-7 rounded border shadow-sm hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: item }}
              onClick={() => selectColor(item)}
              title={index === 0 ? `Текущий цвет ${item}` : item}
              aria-label={index === 0 ? `Текущий цвет ${item}` : `Цвет маркера ${item}`}
            />
          ))}
          <label
            className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded border bg-background shadow-sm hover:ring-2 hover:ring-ring"
            title="Другой цвет"
          >
            <span className="text-sm font-medium">+</span>
            <input
              type="color"
              value={color}
              onChange={(event) => selectColor(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Выбрать другой цвет маркера"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function App() {
  const [markdownContent, setMarkdownContent] = useState(`# Добро пожаловать в Markdown to PDF Converter

Это **пример** документа для демонстрации возможностей конвертера.

## Возможности

- Конвертация Markdown в PDF
- Настройка стилей в реальном времени
- Предпросмотр результата
- Скачивание готового PDF

### Пример кода

\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\`

### Список задач

1. Написать текст в Markdown
2. Настроить стили
3. Скачать PDF

> Это цитата для демонстрации стилей.

**Жирный текст**, *курсив* и <mark>выделение маркером</mark> также поддерживаются.`)

  const [previewMarkdown, setPreviewMarkdown] = useState(markdownContent)

  const [settings, setSettings] = useState({
    font_family: 'Inter',
    font_size: 12,
    line_height: 1.6,
    margin_top: 72,
    margin_bottom: 72,
    margin_left: 72,
    margin_right: 72,
    text_color: '#000000',
    background_color: '#ffffff',
    highlight_color: '#fff176'
  })

  const [pdfUrl, setPdfUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoPreview, setAutoPreview] = useState(true)
  const [isPreviewStale, setIsPreviewStale] = useState(true)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('document')
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [searchRegexp, setSearchRegexp] = useState(false)
  const [searchStats, setSearchStats] = useState({ current: 0, total: 0, error: null })
  const [syncScroll, setSyncScroll] = useState(true)
  const fileInputRef = useRef(null)
  const editorViewRef = useRef(null)
  const searchInputRef = useRef(null)
  const previewScrollRef = useRef(null)
  const previewAnchorsRef = useRef([])
  const syncFrameRef = useRef(null)
  const pdfBlobRef = useRef(null)
  const previewUrlRef = useRef(null)
  const pendingRenderRef = useRef(null)
  const renderInFlightRef = useRef(false)
  const latestRenderInputRef = useRef(null)
  const largeDocumentDetectedRef = useRef(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const backendUrl = (() => {
    const configuredUrl = import.meta?.env?.VITE_BACKEND_URL
    if (configuredUrl) return configuredUrl

    // Electron production loads the UI from file://, so relative fetches
    // would target the app bundle instead of the local FastAPI server.
    if (window?.electron?.isElectron || window.location.protocol === 'file:') {
      return 'http://localhost:8000'
    }

    return ''
  })()

  const [backendReady, setBackendReady] = useState(false)
  const [backendStatus, setBackendStatus] = useState('starting')
  const backendReadyRef = useRef(false)
  const isLargeDocument = markdownContent.length >= LARGE_DOCUMENT_THRESHOLD
  const isHtmlPreviewStale = IS_ELECTRON && previewMarkdown !== markdownContent

  latestRenderInputRef.current = { content: markdownContent, settings }

  const undo = useCallback(() => {
    if (editorViewRef.current) cmUndo(editorViewRef.current)
  }, [])

  const redo = useCallback(() => {
    if (editorViewRef.current) cmRedo(editorViewRef.current)
  }, [])

  const handleEditorChange = useCallback((value) => {
    setMarkdownContent(value)
  }, [])

  const handleEditorCreate = useCallback((view) => {
    editorViewRef.current = view
  }, [])

  const buildSearchQuery = useCallback(() => new SearchQuery({
    search: searchText,
    replace: replaceText,
    caseSensitive: searchCaseSensitive,
    regexp: searchRegexp,
  }), [replaceText, searchCaseSensitive, searchRegexp, searchText])

  const updateSearch = useCallback((command) => {
    const view = editorViewRef.current
    if (!view) return

    const query = buildSearchQuery()
    view.dispatch({ effects: setSearchQuery.of(query) })
    if (command && query.valid && query.search) command(view)
    setSearchStats(getSearchStats(view, query))
  }, [buildSearchQuery])

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchStats({ current: 0, total: 0, error: null })

    const view = editorViewRef.current
    if (view) {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
      view.focus()
    }
  }, [])

  const handleSearchKeyDown = (event, enterCommand = findNext) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      updateSearch(event.shiftKey && enterCommand === findNext ? findPrevious : enterCommand)
    }
  }

  const handleEditorUpdate = useCallback((update) => {
    if (showSearch && (update.docChanged || update.selectionSet)) {
      const query = buildSearchQuery()
      setSearchStats(getSearchStats(update.view, query))
    }

    if (!IS_ELECTRON || !syncScroll || !update.viewportChanged || !previewScrollRef.current) return
    if (syncFrameRef.current) window.cancelAnimationFrame(syncFrameRef.current)

    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncFrameRef.current = null
      const view = editorViewRef.current
      const preview = previewScrollRef.current
      if (!view || !preview) return

      const lineBlock = view.lineBlockAtHeight(view.scrollDOM.scrollTop)
      const sourceLine = view.state.doc.lineAt(lineBlock.from).number
      const target = getPreviewTarget(previewAnchorsRef.current, sourceLine)
      const maxScroll = Math.max(0, preview.scrollHeight - preview.clientHeight)
      preview.scrollTop = Math.min(maxScroll, Math.max(0, target - 12))
    })
  }, [buildSearchQuery, showSearch, syncScroll])

  const replacePreview = useCallback((pdfBlob) => {
    const nextUrl = URL.createObjectURL(pdfBlob)
    const previousUrl = previewUrlRef.current

    pdfBlobRef.current = pdfBlob
    previewUrlRef.current = nextUrl
    setPdfUrl(nextUrl)

    if (previousUrl) {
      window.setTimeout(() => URL.revokeObjectURL(previousUrl), 0)
    }
  }, [])

  const processRenderQueue = useCallback(async () => {
    if (renderInFlightRef.current || !backendReadyRef.current || !pendingRenderRef.current) return

    renderInFlightRef.current = true
    setIsLoading(true)

    try {
      while (backendReadyRef.current && pendingRenderRef.current) {
        const job = pendingRenderRef.current
        pendingRenderRef.current = null
        setError(null)

        try {
          const response = await fetch(`${backendUrl}/convert/pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf'
            },
            body: JSON.stringify({
              content: job.content,
              ...job.settings
            })
          })

          if (!response.ok) {
            let detail = `HTTP ${response.status}`
            try {
              const errorJson = await response.json()
              if (errorJson?.detail) detail = errorJson.detail
            } catch {
              // Ignore malformed error responses.
            }
            throw new Error(detail)
          }

          const pdfBlob = await response.blob()
          const latestInput = latestRenderInputRef.current
          const isLatestInput = job.content === latestInput.content && job.settings === latestInput.settings

          if (isLatestInput) {
            replacePreview(pdfBlob)
            setIsPreviewStale(false)
          }
        } catch (err) {
          const message = err?.message || String(err)
          const isNetworkError = /Failed to fetch|NetworkError|Load failed/i.test(message)

          if (isNetworkError) {
            if (!pendingRenderRef.current) pendingRenderRef.current = job
            backendReadyRef.current = false
            setBackendReady(false)
            setBackendStatus('starting')
            setError('Backend запускается, подождите…')
          } else {
            const latestInput = latestRenderInputRef.current
            if (job.content === latestInput.content && job.settings === latestInput.settings) {
              setError(`Ошибка: ${message}`)
            }
          }
        }
      }
    } finally {
      renderInFlightRef.current = false
      setIsLoading(Boolean(pendingRenderRef.current && !backendReadyRef.current))
    }
  }, [backendUrl, replacePreview])

  const queuePdfRender = useCallback((content, currentSettings) => {
    if (!content.trim()) return

    pendingRenderRef.current = { content, settings: currentSettings }
    setIsPreviewStale(true)
    setError(null)

    if (!backendReadyRef.current) {
      setIsLoading(true)
      return
    }

    void processRenderQueue()
  }, [processRenderQueue])

  const renderCurrentDocument = useCallback(() => {
    queuePdfRender(markdownContent, settings)
  }, [markdownContent, queuePdfRender, settings])

  useEffect(() => {
    if (IS_ELECTRON) return
    setIsPreviewStale(Boolean(markdownContent.trim()))
  }, [markdownContent, settings])

  useEffect(() => {
    if (IS_ELECTRON) return
    if (isLargeDocument && !largeDocumentDetectedRef.current) {
      pendingRenderRef.current = null
      setAutoPreview(false)
      if (!renderInFlightRef.current) setIsLoading(false)
    }
    largeDocumentDetectedRef.current = isLargeDocument
  }, [isLargeDocument])

  // Большие документы рендерятся вручную по умолчанию. Если автообновление
  // включено пользователем, оно получает более длинную паузу после ввода.
  useEffect(() => {
    if (IS_ELECTRON || !autoPreview || !markdownContent.trim()) return undefined

    const delay = isLargeDocument ? LARGE_PREVIEW_DEBOUNCE_MS : PREVIEW_DEBOUNCE_MS
    const timeoutId = window.setTimeout(() => {
      queuePdfRender(markdownContent, settings)
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [autoPreview, isLargeDocument, markdownContent, queuePdfRender, settings])

  // Проверка готовности backend (для Electron/Web)
  useEffect(() => {
    if (IS_ELECTRON || backendReady) return undefined

    let cancelled = false
    let timeoutId
    let attempts = 0

    const check = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`${backendUrl}/health`, { cache: 'no-store' })
        if (res.ok) {
          setBackendReady(true)
          setBackendStatus('ready')
          return
        }
      } catch {
        // Backend may still be starting.
      }

      attempts += 1
      setBackendStatus('starting')
      const delay = Math.min(500 + attempts * 200, 3000)
      timeoutId = window.setTimeout(check, delay)
    }

    void check()
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [backendReady, backendUrl])

  useEffect(() => {
    if (IS_ELECTRON) return
    backendReadyRef.current = backendReady
    if (backendReady) void processRenderQueue()
  }, [backendReady, processRenderQueue])

  useEffect(() => {
    if (!IS_ELECTRON) return undefined

    const delay = isLargeDocument
      ? LARGE_HTML_PREVIEW_DEBOUNCE_MS
      : HTML_PREVIEW_DEBOUNCE_MS
    const timeoutId = window.setTimeout(() => {
      startTransition(() => setPreviewMarkdown(markdownContent))
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [isLargeDocument, markdownContent])

  useEffect(() => {
    if (!showSearch) return undefined

    const timeoutId = window.setTimeout(() => {
      updateSearch()
      searchInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [showSearch, updateSearch])

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (showSearch) searchInputRef.current?.focus()
        else setShowSearch(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [showSearch])

  useEffect(() => {
    if (!IS_ELECTRON || !previewScrollRef.current) return undefined

    const frameId = window.requestAnimationFrame(() => {
      const preview = previewScrollRef.current
      if (!preview) return

      const previewRect = preview.getBoundingClientRect()
      const anchors = Array.from(preview.querySelectorAll('[data-source-line]'))
        .map((element) => ({
          line: Number(element.dataset.sourceLine),
          top: element.getBoundingClientRect().top - previewRect.top + preview.scrollTop,
        }))
        .filter((anchor) => Number.isFinite(anchor.line))
        .sort((left, right) => left.line - right.line || left.top - right.top)
        .filter((anchor, index, values) => index === 0 || anchor.line !== values[index - 1].line)

      previewAnchorsRef.current = anchors
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [previewMarkdown, settings])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    if (syncFrameRef.current) window.cancelAnimationFrame(syncFrameRef.current)
  }, [])

  const downloadPdf = async () => {
    if (IS_ELECTRON) {
      if (!markdownContent.trim() || isLoading) return

      setIsLoading(true)
      setError(null)

      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve))
        const { renderMarkdownToHtml } = await import('@/components/markdown-export.js')
        const html = renderMarkdownToHtml(markdownContent)
        await window.electron.exportPdf({
          html,
          settings,
          fileName: `${fileName || 'document'}.pdf`,
        })
      } catch (err) {
        setError(`Ошибка экспорта: ${err?.message || String(err)}`)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (!pdfBlobRef.current || !previewUrlRef.current) return

    const a = document.createElement('a')
    a.href = previewUrlRef.current
    a.download = `${fileName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Проверка расширения файла
    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
      setError('Пожалуйста, выберите файл Markdown (.md)')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setMarkdownContent(text)
        // Устанавливаем имя файла без расширения
        const nameWithoutExt = file.name.replace(/\.(md|markdown)$/i, '')
        setFileName(nameWithoutExt)
        setError(null)
      }
    }
    reader.onerror = () => {
      setError('Ошибка при чтении файла')
    }
    reader.readAsText(file)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Функции для вставки форматирования (CodeMirror API)
  const insertFormatting = (before, after = '', placeholder = '') => {
    const view = editorViewRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)
    const textToInsert = selectedText || placeholder

    view.dispatch({
      changes: { from, to, insert: before + textToInsert + after },
      selection: { anchor: from + before.length + textToInsert.length }
    })
    view.focus()
  }

  const insertHighlight = (color) => {
    const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : settings.highlight_color
    insertFormatting(
      `<mark style="background-color: ${safeColor}">`,
      '</mark>',
      'выделенный текст'
    )
  }

  const insertLineFormatting = (prefix, placeholder = '') => {
    const view = editorViewRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const startLine = view.state.doc.lineAt(from)
    const endLine = view.state.doc.lineAt(to)
    const changes = []

    for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
      const line = view.state.doc.line(lineNum)
      if (line.text.trim() === '' && placeholder) {
        changes.push({ from: line.from, to: line.to, insert: prefix + placeholder })
      } else if (!line.text.startsWith(prefix)) {
        changes.push({ from: line.from, insert: prefix })
      }
    }

    view.dispatch({ changes })
    view.focus()
  }

  const insertBlock = (template) => {
    const view = editorViewRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const beforeText = view.state.sliceDoc(0, from)
    const afterText = view.state.sliceDoc(to)

    const needsNewlineBefore = beforeText && !beforeText.endsWith('\n')
    const needsNewlineAfter = afterText && !afterText.startsWith('\n')

    const insert =
      (needsNewlineBefore ? '\n\n' : '') +
      template +
      (needsNewlineAfter ? '\n\n' : '')

    view.dispatch({ changes: { from, to, insert } })
    view.focus()
  }

  const insertCodeBlock = (language = 'javascript', placeholder = '// код') => {
    const view = editorViewRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)
    const beforeText = view.state.sliceDoc(0, from)
    const afterText = view.state.sliceDoc(to)

    const needsNewlineBefore = beforeText && !beforeText.endsWith('\n')
    const needsNewlineAfter = afterText && !afterText.startsWith('\n')
    const openingFence = `\`\`\`${language}`
    const codeContent = selectedText || placeholder
    const closingNewline = codeContent.endsWith('\n') ? '' : '\n'
    const insert =
      (needsNewlineBefore ? '\n\n' : '') +
      `${openingFence}\n${codeContent}${closingNewline}\`\`\`` +
      (needsNewlineAfter ? '\n\n' : '')

    const codeStart = from + (needsNewlineBefore ? 2 : 0) + openingFence.length + 1
    const codeEnd = codeStart + codeContent.length

    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: codeStart, head: codeEnd }
    })
    view.focus()
  }

  // Обработка выделения текста для показа всплывающей панели
  const handleTextSelect = (e) => {
    setTimeout(() => {
      const view = editorViewRef.current
      const selection = view?.state?.selection?.main
      const hasSelection = selection && selection.from !== selection.to

      if (hasSelection) {
        const mouseX = e?.clientX
        const mouseY = e?.clientY

        if (mouseX && mouseY) {
          const toolbarWidth = 320
          const toolbarHeight = 40

          let left = mouseX - (toolbarWidth / 2)
          let top = mouseY - toolbarHeight - 25

          if (left < 10) left = 10
          if (left + toolbarWidth > window.innerWidth - 10) {
            left = window.innerWidth - toolbarWidth - 10
          }
          if (top < 10) {
            top = mouseY + 20
          }

          setToolbarPosition({ top, left })
          setShowToolbar(true)
        }
      } else {
        setShowToolbar(false)
      }
    }, 0)
  }

  // Закрыть панель при клике вне её
  useEffect(() => {
    const handleClickOutside = () => {
      const view = editorViewRef.current
      const selection = view?.state?.selection?.main
      if (!selection || selection.from === selection.to) {
        setShowToolbar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  return (
    <div className="h-screen bg-background p-2 flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Верхняя панель */}
        <div className="flex items-center gap-2 mb-2 px-2 py-2 border-b overflow-x-auto shrink-0">
          {/* Файл */}
          <Button onClick={openFileDialog} variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Upload className="h-3.5 w-3.5" />
            Открыть .md
          </Button>
          <div className="flex items-center gap-1 shrink-0">
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="h-8 w-28 text-sm" placeholder="document" />
            <span className="text-sm text-muted-foreground">.pdf</span>
          </div>
          <Button
            onClick={downloadPdf}
            disabled={IS_ELECTRON ? !markdownContent.trim() || isLoading : !pdfUrl}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {IS_ELECTRON && isLoading ? 'Создание PDF…' : 'Скачать PDF'}
          </Button>

          <div className="w-px h-6 bg-border shrink-0 mx-1" />

          {/* Типографика */}
          <div className="flex items-center gap-3 bg-muted/40 border rounded-lg px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Шрифт</span>
              <Select value={settings.font_family} onValueChange={(value) => updateSetting('font_family', value)}>
                <SelectTrigger className="h-7 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times-Roman">Times Roman</SelectItem>
                  <SelectItem value="Courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">px</span>
              <Input type="number" value={settings.font_size} onChange={(e) => updateSetting('font_size', parseInt(e.target.value) || 12)} min="8" max="24" className="h-7 w-12 text-xs text-center px-1" />
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">×</span>
              <Input type="number" step="0.1" value={settings.line_height} onChange={(e) => updateSetting('line_height', parseFloat(e.target.value) || 1.6)} min="1" max="3" className="h-7 w-14 text-xs text-center px-1" />
            </div>
          </div>

          {/* Цвета */}
          <div className="flex items-center gap-3 bg-muted/40 border rounded-lg px-3 py-1.5 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-muted-foreground font-medium">Текст</span>
              <div className="relative h-7 w-8 rounded-md border shadow-sm overflow-hidden hover:ring-2 hover:ring-ring transition-all">
                <div className="absolute inset-0" style={{ backgroundColor: settings.text_color }} />
                <input type="color" value={settings.text_color} onChange={(e) => updateSetting('text_color', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </label>
            <div className="w-px h-4 bg-border" />
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-muted-foreground font-medium">Фон</span>
              <div className="relative h-7 w-8 rounded-md border shadow-sm overflow-hidden hover:ring-2 hover:ring-ring transition-all">
                <div className="absolute inset-0 bg-[repeating-conic-gradient(#aaa_0%_25%,#fff_0%_50%)] bg-[length:8px_8px]" />
                <div className="absolute inset-0" style={{ backgroundColor: settings.background_color }} />
                <input type="color" value={settings.background_color} onChange={(e) => updateSetting('background_color', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </label>
            <div className="w-px h-4 bg-border" />
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-muted-foreground font-medium">Маркер</span>
              <div className="relative h-7 w-8 rounded-md border shadow-sm overflow-hidden hover:ring-2 hover:ring-ring transition-all">
                <div className="absolute inset-0" style={{ backgroundColor: settings.highlight_color }} />
                <input type="color" value={settings.highlight_color} onChange={(e) => updateSetting('highlight_color', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </label>
          </div>

          {/* Поля — выпадающее */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 bg-muted/40 border rounded-lg px-3 py-1.5 shrink-0 text-xs text-muted-foreground font-medium hover:bg-muted/70 transition-colors cursor-pointer">
                Поля
                <span className="text-muted-foreground/60">
                  {settings.margin_top}·{settings.margin_right}·{settings.margin_bottom}·{settings.margin_left}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-4">
              <p className="text-sm font-medium mb-3">Поля страницы (pt)</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground w-16">Верх</span>
                  <Input type="number" value={settings.margin_top} onChange={(e) => updateSetting('margin_top', parseInt(e.target.value) || 0)} min="0" max="200" className="h-7 w-20 text-xs text-center" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground w-16">Низ</span>
                  <Input type="number" value={settings.margin_bottom} onChange={(e) => updateSetting('margin_bottom', parseInt(e.target.value) || 0)} min="0" max="200" className="h-7 w-20 text-xs text-center" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground w-16">Левое</span>
                  <Input type="number" value={settings.margin_left} onChange={(e) => updateSetting('margin_left', parseInt(e.target.value) || 0)} min="0" max="200" className="h-7 w-20 text-xs text-center" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground w-16">Правое</span>
                  <Input type="number" value={settings.margin_right} onChange={(e) => updateSetting('margin_right', parseInt(e.target.value) || 0)} min="0" max="200" className="h-7 w-20 text-xs text-center" />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 gap-2 flex-1 min-h-0 lg:grid-cols-2">
          {/* Редактор Markdown */}
          <Card className="flex flex-col">
            <CardContent className="p-2 flex-1 min-h-0 flex flex-col gap-2 relative">
              {/* Всплывающая панель инструментов при выделении */}
              {showToolbar && (
                <div
                  className="fixed z-50 flex items-center gap-1 p-1 border rounded-md bg-background shadow-lg"
                  style={{
                    top: `${toolbarPosition.top}px`,
                    left: `${toolbarPosition.left}px`,
                  }}
                >
                  <Button
                    onClick={() => { insertFormatting('**', '**', 'жирный текст'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Жирный"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => { insertFormatting('*', '*', 'курсив'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Курсив"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <HighlightColorPicker
                    color={settings.highlight_color}
                    onSelect={(color) => {
                      insertHighlight(color)
                      setShowToolbar(false)
                    }}
                  />
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    onClick={() => { insertLineFormatting('# ', 'Заголовок 1'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Заголовок 1"
                  >
                    <Heading1 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => { insertLineFormatting('## ', 'Заголовок 2'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Заголовок 2"
                  >
                    <Heading2 className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    onClick={() => { insertFormatting('`', '`', 'код'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Код"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => { insertLineFormatting('> ', 'Цитата'); setShowToolbar(false); }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Цитата"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Панель инструментов форматирования */}
              <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/50 flex-wrap">
                <Button
                  onClick={undo}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Отменить (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={redo}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Повторить (Ctrl+Y / Ctrl+Shift+Z)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => {
                    if (showSearch) closeSearch()
                    else setShowSearch(true)
                  }}
                  variant={showSearch ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Поиск и замена (Ctrl+F)"
                  aria-label="Поиск и замена"
                >
                  <SearchIcon className="h-3.5 w-3.5" />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  onClick={() => insertFormatting('**', '**', 'жирный текст')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Жирный (Ctrl+B)"
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => insertFormatting('*', '*', 'курсив')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Курсив (Ctrl+I)"
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <HighlightColorPicker
                  color={settings.highlight_color}
                  onSelect={insertHighlight}
                />
                <Separator orientation="vertical" className="h-5" />
                <Button
                  onClick={() => insertLineFormatting('# ', 'Заголовок 1')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Заголовок 1"
                >
                  <Heading1 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => insertLineFormatting('## ', 'Заголовок 2')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Заголовок 2"
                >
                  <Heading2 className="h-3.5 w-3.5" />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  onClick={() => insertLineFormatting('- ', 'Элемент списка')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Маркированный список"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => insertLineFormatting('1. ', 'Элемент списка')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Нумерованный список"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  onClick={() => insertFormatting('`', '`', 'код')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Inline код"
                >
                  <Code className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => insertCodeBlock('javascript', '// код')}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  title="Блок кода"
                >
                  <Code className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Блок</span>
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  onClick={() => insertLineFormatting('> ', 'Цитата')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Цитата"
                >
                  <Quote className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => insertBlock('| Заголовок 1 | Заголовок 2 |\n|-------------|-------------|\n| Ячейка 1    | Ячейка 2    |')}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Таблица"
                >
                  <Table className="h-3.5 w-3.5" />
                </Button>
              </div>

              {showSearch && (
                <div className="flex flex-wrap items-center gap-1.5 border-b px-1 pb-2">
                  <Input
                    ref={searchInputRef}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    onKeyDown={(event) => handleSearchKeyDown(event)}
                    className="h-7 min-w-32 flex-1 text-xs"
                    placeholder="Найти"
                    aria-label="Текст для поиска"
                  />
                  <span className={`min-w-14 text-center text-xs ${searchStats.error ? 'text-destructive' : 'text-muted-foreground'}`} title={searchStats.error || undefined}>
                    {searchStats.error ? 'Ошибка' : `${searchStats.current} / ${searchStats.total}`}
                  </span>
                  <Button onClick={() => updateSearch(findPrevious)} variant="ghost" size="sm" className="h-7 w-7 p-0" title="Предыдущее совпадение" aria-label="Предыдущее совпадение">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={() => updateSearch(findNext)} variant="ghost" size="sm" className="h-7 w-7 p-0" title="Следующее совпадение" aria-label="Следующее совпадение">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={() => setSearchCaseSensitive((enabled) => !enabled)} variant={searchCaseSensitive ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 text-xs" title="Учитывать регистр">
                    Aa
                  </Button>
                  <Button onClick={() => setSearchRegexp((enabled) => !enabled)} variant={searchRegexp ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2 font-mono text-xs" title="Регулярное выражение">
                    .*
                  </Button>
                  <Button onClick={closeSearch} variant="ghost" size="sm" className="h-7 w-7 p-0" title="Закрыть поиск" aria-label="Закрыть поиск">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    value={replaceText}
                    onChange={(event) => setReplaceText(event.target.value)}
                    onKeyDown={(event) => handleSearchKeyDown(event, replaceNext)}
                    className="h-7 min-w-32 flex-1 text-xs"
                    placeholder="Заменить на"
                    aria-label="Текст для замены"
                  />
                  <Button onClick={() => updateSearch(replaceNext)} variant="outline" size="sm" className="h-7 text-xs" disabled={!searchText || Boolean(searchStats.error)}>
                    Заменить
                  </Button>
                  <Button onClick={() => updateSearch(replaceAll)} variant="outline" size="sm" className="h-7 text-xs" disabled={!searchText || Boolean(searchStats.error)}>
                    Заменить все
                  </Button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-auto" onMouseUp={handleTextSelect}>
                <CodeMirror
                  value={markdownContent}
                  onChange={handleEditorChange}
                  onCreateEditor={handleEditorCreate}
                  onUpdate={handleEditorUpdate}
                  extensions={EDITOR_EXTENSIONS}
                  basicSetup={EDITOR_BASIC_SETUP}
                  style={EDITOR_STYLE}
                  placeholder="Введите ваш Markdown текст здесь..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Предпросмотр документа */}
          <Card className="flex flex-col">
            <CardContent className="p-2 flex-1 min-h-0 flex flex-col gap-2">
              {IS_ELECTRON ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">HTML-предпросмотр</span>
                      <Switch
                        id="sync-scroll"
                        checked={syncScroll}
                        onCheckedChange={setSyncScroll}
                        aria-label="Синхронизировать прокрутку"
                      />
                      <label htmlFor="sync-scroll" className="cursor-pointer text-xs text-muted-foreground">
                        Синхронизация
                      </label>
                    </div>
                    <span
                      className={`text-xs ${error && !isLoading ? 'text-destructive' : 'text-muted-foreground'}`}
                      aria-live="polite"
                    >
                      {isLoading
                        ? 'Создание PDF…'
                        : error
                          ? 'Ошибка экспорта'
                          : isHtmlPreviewStale
                            ? 'Обновление…'
                            : 'Актуально'}
                    </span>
                  </div>

                  {error && !isLoading && (
                    <p className="px-1 text-xs text-destructive">{error}</p>
                  )}

                  <div className="flex-1 min-h-0 overflow-hidden border rounded-md">
                    <MarkdownPreview ref={previewScrollRef} content={previewMarkdown} settings={settings} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Switch
                        id="auto-preview"
                        checked={autoPreview}
                        onCheckedChange={setAutoPreview}
                        aria-label="Автоматически обновлять PDF"
                      />
                      <label htmlFor="auto-preview" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                        Автопросмотр
                      </label>
                      {isLargeDocument && (
                        <span className="text-xs text-amber-700 whitespace-nowrap">
                          Большой документ
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs ${error && !isLoading ? 'text-destructive' : 'text-muted-foreground'}`}
                        aria-live="polite"
                      >
                        {backendStatus !== 'ready' && isLoading
                          ? 'Запуск backend…'
                          : isLoading
                            ? 'Генерация PDF…'
                            : error
                              ? 'Ошибка генерации'
                              : isPreviewStale
                                ? 'Есть изменения'
                                : pdfUrl
                                  ? 'Готово'
                                  : ''}
                      </span>
                      <Button
                        onClick={renderCurrentDocument}
                        disabled={!markdownContent.trim()}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        title="Обновить предпросмотр PDF"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Обновить
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0">
                    {pdfUrl && (
                      <div className="h-full border rounded-md overflow-hidden">
                        <iframe
                          src={pdfUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                      </div>
                    )}

                    {!pdfUrl && isLoading && (
                      <div className="flex items-center justify-center h-full border rounded-md bg-muted/30">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {backendStatus === 'ready' ? 'Генерация PDF...' : 'Запуск backend...'}
                          </p>
                        </div>
                      </div>
                    )}

                    {!pdfUrl && error && !isLoading && (
                      <div className="flex items-center justify-center h-full border rounded-md">
                        <div className="text-center">
                          <p className="text-sm text-destructive mb-2">Ошибка генерации PDF</p>
                          <p className="text-xs text-muted-foreground">{error}</p>
                        </div>
                      </div>
                    )}

                    {!pdfUrl && !isLoading && !error && (
                      <div className="flex items-center justify-center h-full border rounded-md bg-muted/50">
                        <div className="text-center">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Предпросмотр не обновлён</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

export default App
