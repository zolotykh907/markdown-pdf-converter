import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Download, FileText, Settings } from 'lucide-react'
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

  const convertToPdf = useCallback(async () => {
    if (!markdownContent.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8000/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: markdownContent,
          ...settings
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setPdfData(data.pdf_base64)
      } else {
        setError(data.message || 'Ошибка при конвертации')
      }
    } catch (err) {
      setError(`Ошибка: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [markdownContent, settings])

  // Автоматическая конвертация при изменении контента или настроек
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      convertToPdf()
    }, 1000) // Debounce 1 секунда

    return () => clearTimeout(timeoutId)
  }, [convertToPdf])

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
    a.download = 'document.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <div className="h-screen bg-background p-6 flex flex-col">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col h-full">
        <header className="mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Markdown to PDF Converter
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_260px] gap-4 flex-1 min-h-0">
          {/* Редактор Markdown */}
          <Card className="flex flex-col">
            <CardHeader className="py-3 flex-shrink-0">
              <CardTitle className="text-base">Markdown Editor</CardTitle>
            </CardHeader>
            <CardContent className="p-3 flex-1 min-h-0">
              <Textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="Введите ваш Markdown текст здесь..."
                className="h-full font-mono text-sm resize-none"
              />
            </CardContent>
          </Card>

          {/* Предпросмотр PDF */}
          <Card className="flex flex-col">
            <CardHeader className="py-3 flex-shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-base">PDF Preview</CardTitle>
              <Button
                onClick={downloadPdf}
                disabled={!pdfData || isLoading}
                size="icon"
                className="h-8 w-8"
                title="Скачать PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-3 flex-1 min-h-0">
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Генерация PDF...</p>
                  </div>
                </div>
              )}

              {error && (
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
          <Card className="self-start">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Настройки
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
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

              {pdfData && !error && (
                <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-700">PDF готов!</p>
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

