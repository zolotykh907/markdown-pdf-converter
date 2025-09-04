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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Markdown to PDF Converter
          </h1>
          <p className="text-muted-foreground mt-2">
            Конвертируйте Markdown в PDF с настраиваемыми стилями в реальном времени
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Редактор Markdown */}
          <div className="xl:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Markdown Editor</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    placeholder="Введите ваш Markdown текст здесь..."
                    className="min-h-[500px] font-mono"
                  />
                </CardContent>
              </Card>

              {/* Предпросмотр PDF */}
              <Card>
                <CardHeader>
                  <CardTitle>PDF Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading && (
                    <div className="flex items-center justify-center h-[500px]">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Генерация PDF...</p>
                      </div>
                    </div>
                  )}
                  
                  {error && (
                    <div className="flex items-center justify-center h-[500px]">
                      <div className="text-center">
                        <p className="text-sm text-destructive mb-2">Ошибка генерации PDF</p>
                        <p className="text-xs text-muted-foreground">{error}</p>
                      </div>
                    </div>
                  )}
                  
                  {pdfData && !isLoading && !error && (
                    <div className="h-[500px] border rounded-md overflow-hidden">
                      <iframe
                        src={`data:application/pdf;base64,${pdfData}`}
                        className="w-full h-full"
                        title="PDF Preview"
                      />
                    </div>
                  )}
                  
                  {!pdfData && !isLoading && !error && (
                    <div className="flex items-center justify-center h-[500px] border rounded-md bg-muted/50">
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

          {/* Панель настроек */}
          <div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Настройки стилей
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="font-family">Шрифт</Label>
                  <Select value={settings.font_family} onValueChange={(value) => updateSetting('font_family', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter (Рекомендуется)</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Times-Roman">Times Roman</SelectItem>
                      <SelectItem value="Courier">Courier</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="font-size">Размер шрифта (pt)</Label>
                  <Input
                    id="font-size"
                    type="number"
                    value={settings.font_size}
                    onChange={(e) => updateSetting('font_size', parseInt(e.target.value) || 12)}
                    min="8"
                    max="24"
                  />
                </div>

                <div>
                  <Label htmlFor="line-height">Межстрочный интервал</Label>
                  <Input
                    id="line-height"
                    type="number"
                    step="0.1"
                    value={settings.line_height}
                    onChange={(e) => updateSetting('line_height', parseFloat(e.target.value) || 1.6)}
                    min="1"
                    max="3"
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor="text-color">Цвет текста</Label>
                  <Input
                    id="text-color"
                    type="color"
                    value={settings.text_color}
                    onChange={(e) => updateSetting('text_color', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bg-color">Цвет фона</Label>
                  <Input
                    id="bg-color"
                    type="color"
                    value={settings.background_color}
                    onChange={(e) => updateSetting('background_color', e.target.value)}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="margin-top">Отступ сверху</Label>
                    <Input
                      id="margin-top"
                      type="number"
                      value={settings.margin_top}
                      onChange={(e) => updateSetting('margin_top', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                    />
                  </div>
                  <div>
                    <Label htmlFor="margin-bottom">Отступ снизу</Label>
                    <Input
                      id="margin-bottom"
                      type="number"
                      value={settings.margin_bottom}
                      onChange={(e) => updateSetting('margin_bottom', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                    />
                  </div>
                  <div>
                    <Label htmlFor="margin-left">Отступ слева</Label>
                    <Input
                      id="margin-left"
                      type="number"
                      value={settings.margin_left}
                      onChange={(e) => updateSetting('margin_left', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                    />
                  </div>
                  <div>
                    <Label htmlFor="margin-right">Отступ справа</Label>
                    <Input
                      id="margin-right"
                      type="number"
                      value={settings.margin_right}
                      onChange={(e) => updateSetting('margin_right', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Кнопка скачивания */}
            <Card>
              <CardContent className="pt-6">
                <Button 
                  onClick={downloadPdf} 
                  disabled={!pdfData || isLoading}
                  className="w-full"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? 'Конвертация...' : 'Скачать PDF'}
                </Button>
                
                {error && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                
                {pdfData && !error && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">PDF готов к скачиванию!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

