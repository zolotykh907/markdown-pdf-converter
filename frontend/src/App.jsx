import { useState, useEffect, useCallback, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx'
import { Download, FileText, Upload, Bold, Italic, Heading1, Heading2, List, ListOrdered, Code, Quote, Table, Undo2, Redo2 } from 'lucide-react'
import './App.css'

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

**Жирный текст** и *курсив* также поддерживаются.`)

  const [settings, setSettings] = useState({
    font_family: 'Inter',
    font_size: 12,
    line_height: 1.6,
    margin_top: 72,
    margin_bottom: 72,
    margin_left: 72,
    margin_right: 72,
    text_color: '#000000',
    background_color: '#ffffff'
  })

  const [pdfData, setPdfData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('document')
  const fileInputRef = useRef(null)
  const editorViewRef = useRef(null)
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
  const pendingConvert = useRef(false)

  const undo = useCallback(() => {
    if (editorViewRef.current) cmUndo(editorViewRef.current)
  }, [])

  const redo = useCallback(() => {
    if (editorViewRef.current) cmRedo(editorViewRef.current)
  }, [])

  const convertToPdf = useCallback(async () => {
    if (!markdownContent.trim()) return

    if (!backendReady) {
      pendingConvert.current = true
      setIsLoading(true)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${backendUrl}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: markdownContent,
          ...settings
        })
      })

      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const errorJson = await response.json()
          if (errorJson?.detail) detail = errorJson.detail
        } catch (_) {
          // ignore json parse errors
        }
        throw new Error(detail)
      }

      const result = await response.json()

      if (result.success) {
        setPdfData(result.pdf_base64)
      } else {
        setError(result.message || 'Ошибка при конвертации')
      }
    } catch (err) {
      const message = (err && err.message) ? err.message : String(err)
      if (/Failed to fetch|NetworkError|NetworkError when attempting to fetch resource/i.test(message)) {
        setBackendStatus('starting')
        pendingConvert.current = true
        setError('Backend запускается, подождите…')
      } else {
        setError(`Ошибка: ${message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }, [markdownContent, settings, backendReady, backendUrl])

  // Автоматическая конвертация при изменении контента или настроек
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      convertToPdf()
    }, 1000) // Debounce 1 секунда

    return () => clearTimeout(timeoutId)
  }, [convertToPdf])

  // Проверка готовности backend (для Electron/Web)
  useEffect(() => {
    setBackendReady(false)
    let cancelled = false
    let attempts = 0

    const check = async () => {
      if (cancelled || backendReady) return
      try {
        const res = await fetch(`${backendUrl}/health`, { cache: 'no-store' })
        if (res.ok) {
          setBackendReady(true)
          setBackendStatus('ready')
          return
        }
      } catch (_) {
        // ignore
      }

      attempts += 1
      setBackendStatus('starting')
      const delay = Math.min(500 + attempts * 200, 3000)
      setTimeout(check, delay)
    }

    check()
    return () => {
      cancelled = true
    }
  }, [backendUrl])

  // Если backend только что поднялся, делаем отложенную конвертацию
  useEffect(() => {
    if (backendReady && pendingConvert.current) {
      pendingConvert.current = false
      convertToPdf()
    }
  }, [backendReady, convertToPdf])

  const downloadPdf = () => {
    if (!pdfData) return

    const byteCharacters = atob(pdfData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
          const toolbarWidth = 280
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
          <Button onClick={downloadPdf} disabled={!pdfData || isLoading} size="sm" className="gap-1.5 shrink-0">
            <Download className="h-3.5 w-3.5" />
            Скачать PDF
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

              <div className="flex-1 min-h-0 overflow-auto" onMouseUp={handleTextSelect}>
                <CodeMirror
                  value={markdownContent}
                  onChange={(value) => setMarkdownContent(value)}
                  onCreateEditor={(view) => { editorViewRef.current = view }}
                  extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping]}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLine: true,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                  }}
                  style={{ height: '100%', fontSize: '13px' }}
                  placeholder="Введите ваш Markdown текст здесь..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Предпросмотр PDF */}
          <Card className="flex flex-col">
            <CardContent className="p-2 flex-1 min-h-0">
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">
                      {backendStatus === 'ready' ? 'Генерация PDF...' : 'Запуск backend...'}
                    </p>
                  </div>
                </div>
              )}

              {error && !isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-sm text-destructive mb-2">Ошибка генерации PDF</p>
                    <p className="text-xs text-muted-foreground">{error}</p>
                  </div>
                </div>
              )}

              {pdfData && !isLoading && !error && (
                <div className="h-full border rounded-md overflow-hidden">
                  <iframe
                    src={`data:application/pdf;base64,${pdfData}`}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              )}

              {!pdfData && !isLoading && !error && (
                <div className="flex items-center justify-center h-full border rounded-md bg-muted/50">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">PDF появится здесь</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

export default App
