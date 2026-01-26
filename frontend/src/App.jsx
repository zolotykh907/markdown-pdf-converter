import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Download, FileText, Settings, Upload, Bold, Italic, Heading1, Heading2, List, ListOrdered, Code, Quote, Table, PanelRightClose, PanelRightOpen, Undo2, Redo2 } from 'lucide-react'
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
  const textareaRef = useRef(null)
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const [showSettings, setShowSettings] = useState(true)
  const backendUrl = (import.meta?.env?.VITE_BACKEND_URL) || 'http://localhost:8000'

  const [backendReady, setBackendReady] = useState(false)
  const [backendStatus, setBackendStatus] = useState('starting')
  const pendingConvert = useRef(false)

  // История для Undo/Redo
  const [history, setHistory] = useState([`# Добро пожаловать в Markdown to PDF Converter

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

**Жирный текст** и *курсив* также поддерживаются.`])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedo = useRef(false)
  const historyTimeout = useRef(null)

  // Обновление контента с записью в историю (с debounce)
  const updateContent = useCallback((newContent) => {
    setMarkdownContent(newContent)

    if (isUndoRedo.current) {
      isUndoRedo.current = false
      return
    }

    // Debounce для записи в историю (500ms)
    if (historyTimeout.current) {
      clearTimeout(historyTimeout.current)
    }

    historyTimeout.current = setTimeout(() => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1)
        // Не добавляем если контент такой же
        if (newHistory[newHistory.length - 1] === newContent) return prev
        return [...newHistory, newContent]
      })
      setHistoryIndex(prev => prev + 1)
    }, 500)
  }, [historyIndex])

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedo.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setMarkdownContent(history[newIndex])
    }
  }, [historyIndex, history])

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedo.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setMarkdownContent(history[newIndex])
    }
  }, [historyIndex, history])

  // Клавиатурные сокращения для Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

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
  }, [backendUrl, backendReady])

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

  // Функции для вставки форматирования
  const insertFormatting = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = markdownContent.substring(start, end)
    const textToInsert = selectedText || placeholder

    const newText =
      markdownContent.substring(0, start) +
      before + textToInsert + after +
      markdownContent.substring(end)

    setMarkdownContent(newText)

    // Устанавливаем курсор после вставки
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + textToInsert.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const insertLineFormatting = (prefix, placeholder = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const lines = markdownContent.split('\n')

    let currentPos = 0
    let startLine = 0
    let endLine = 0

    // Найти строки, в которых находится выделение
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1 // +1 для \n
      if (currentPos <= start && start < currentPos + lineLength) {
        startLine = i
      }
      if (currentPos <= end && end <= currentPos + lineLength) {
        endLine = i
        break
      }
      currentPos += lineLength
    }

    // Применить форматирование к каждой строке
    for (let i = startLine; i <= endLine; i++) {
      if (lines[i].trim() === '' && placeholder) {
        lines[i] = prefix + placeholder
      } else if (!lines[i].startsWith(prefix)) {
        lines[i] = prefix + lines[i]
      }
    }

    setMarkdownContent(lines.join('\n'))

    setTimeout(() => {
      textarea.focus()
    }, 0)
  }

  const insertBlock = (template) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // Вставляем на новой строке
    const beforeText = markdownContent.substring(0, start)
    const afterText = markdownContent.substring(end)

    const needsNewlineBefore = beforeText && !beforeText.endsWith('\n')
    const needsNewlineAfter = afterText && !afterText.startsWith('\n')

    const newText =
      beforeText +
      (needsNewlineBefore ? '\n\n' : '') +
      template +
      (needsNewlineAfter ? '\n\n' : '') +
      afterText

    setMarkdownContent(newText)

    setTimeout(() => {
      textarea.focus()
    }, 0)
  }

  // Обработка выделения текста для показа всплывающей панели
  const handleTextSelect = (e) => {
    const textarea = textareaRef.current
    if (!textarea) return

    setTimeout(() => {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Если есть выделение
      if (end - start > 0) {
        // Используем координаты мыши для позиционирования
        const mouseX = e?.clientX
        const mouseY = e?.clientY

        if (mouseX && mouseY) {
          // Ширина тулбара примерно 280px
          const toolbarWidth = 280
          const toolbarHeight = 40

          // Позиционируем тулбар над курсором, по центру
          let left = mouseX - (toolbarWidth / 2)
          let top = mouseY - toolbarHeight - 25 // 25px отступ сверху от курсора

          // Не даём тулбару выйти за левый край экрана
          if (left < 10) left = 10
          // Не даём тулбару выйти за правый край экрана
          if (left + toolbarWidth > window.innerWidth - 10) {
            left = window.innerWidth - toolbarWidth - 10
          }
          // Если тулбар выходит за верх экрана, показываем его снизу
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
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      if (end - start === 0) {
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

        {/* Компактная верхняя панель */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-2">
            <Button
              onClick={openFileDialog}
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
            >
              <Upload className="h-3 w-3" />
              Открыть .md
            </Button>
            <div className="flex items-center gap-1.5">
              <Input
                id="filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-7 w-32 text-xs"
                placeholder="document"
              />
              <span className="text-xs text-muted-foreground">.pdf</span>
            </div>
            <Button
              onClick={downloadPdf}
              disabled={!pdfData || isLoading}
              size="sm"
              className="gap-1.5 h-7 text-xs"
            >
              <Download className="h-3 w-3" />
              Скачать PDF
            </Button>
          </div>
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            title={showSettings ? 'Скрыть настройки' : 'Показать настройки'}
          >
            {showSettings ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            {showSettings ? 'Скрыть' : 'Настройки'}
          </Button>
        </div>

        <div className={`grid grid-cols-1 gap-2 flex-1 min-h-0 ${showSettings ? 'lg:grid-cols-[1fr_1fr_240px]' : 'lg:grid-cols-2'}`}>
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
                  disabled={historyIndex <= 0}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Отменить (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
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
                  onClick={() => insertBlock('```javascript\n// код\n```')}
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

              <Textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => updateContent(e.target.value)}
                onMouseUp={handleTextSelect}
                placeholder="Введите ваш Markdown текст здесь..."
                className="flex-1 font-mono text-sm resize-none"
              />
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

          {/* Панель настроек */}
          {showSettings && (
          <Card className="self-start">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" />
                Настройки
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2">
              <div>
                <Label htmlFor="font-family" className="text-xs">Шрифт</Label>
                <Select value={settings.font_family} onValueChange={(value) => updateSetting('font_family', value)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="font-size" className="text-xs">Размер</Label>
                  <Input
                    id="font-size"
                    type="number"
                    value={settings.font_size}
                    onChange={(e) => updateSetting('font_size', parseInt(e.target.value) || 12)}
                    min="8"
                    max="24"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="line-height" className="text-xs">Интервал</Label>
                  <Input
                    id="line-height"
                    type="number"
                    step="0.1"
                    value={settings.line_height}
                    onChange={(e) => updateSetting('line_height', parseFloat(e.target.value) || 1.6)}
                    min="1"
                    max="3"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="text-color" className="text-xs">Текст</Label>
                  <Input
                    id="text-color"
                    type="color"
                    value={settings.text_color}
                    onChange={(e) => updateSetting('text_color', e.target.value)}
                    className="h-8 w-full cursor-pointer mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bg-color" className="text-xs">Фон</Label>
                  <Input
                    id="bg-color"
                    type="color"
                    value={settings.background_color}
                    onChange={(e) => updateSetting('background_color', e.target.value)}
                    className="h-8 w-full cursor-pointer mt-1"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs mb-2 block">Отступы (pt)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Верх"
                    value={settings.margin_top}
                    onChange={(e) => updateSetting('margin_top', parseInt(e.target.value) || 72)}
                    min="0"
                    max="144"
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Низ"
                    value={settings.margin_bottom}
                    onChange={(e) => updateSetting('margin_bottom', parseInt(e.target.value) || 72)}
                    min="0"
                    max="144"
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Лево"
                    value={settings.margin_left}
                    onChange={(e) => updateSetting('margin_left', parseInt(e.target.value) || 72)}
                    min="0"
                    max="144"
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Право"
                    value={settings.margin_right}
                    onChange={(e) => updateSetting('margin_right', parseInt(e.target.value) || 72)}
                    min="0"
                    max="144"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
