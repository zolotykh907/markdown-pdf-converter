import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Download, FileText, Eye, Code2, Settings2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle.jsx'
import { toast, Toaster } from 'sonner'
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
  const [activeTab, setActiveTab] = useState('editor')

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
        toast.success('PDF готов!')
      } else {
        const errorMsg = data.message || 'Ошибка при конвертации'
        setError(errorMsg)
        toast.error('Ошибка', { description: errorMsg })
      }
    } catch (err) {
      const errorMsg = `Ошибка: ${err.message}`
      setError(errorMsg)
      toast.error('Ошибка подключения')
    } finally {
      setIsLoading(false)
    }
  }, [markdownContent, settings])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      convertToPdf()
    }, 1000)

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

    toast.success('PDF скачан!')
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
        {/* Compact Header */}
        <header className="border-b bg-card/50 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative bg-gradient-to-br from-primary to-purple-600 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Markdown to PDF</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : pdfData ? 'bg-green-500' : 'bg-gray-400'}`} />
              {isLoading ? 'Обработка' : pdfData ? 'Готово' : 'Ожидание'}
            </Badge>
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-[1fr_260px] gap-4 px-20 py-4 overflow-hidden max-w-[1600px] mx-auto w-full">
          {/* Left: Editor and Preview */}
          <div className="flex flex-col gap-3 min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b flex-none">
                <div className="flex items-center justify-between">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="h-9">
                      <TabsTrigger value="editor" className="gap-1.5 text-sm">
                        <Code2 className="h-3.5 w-3.5" />
                        Редактор
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="gap-1.5 text-sm">
                        <Eye className="h-3.5 w-3.5" />
                        Предпросмотр
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    onClick={downloadPdf}
                    disabled={!pdfData || isLoading}
                    size="icon"
                    className="ml-3 h-9 w-9 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <Tabs value={activeTab} className="h-full">
                  <TabsContent value="editor" className="h-full m-0 p-3">
                    <Textarea
                      value={markdownContent}
                      onChange={(e) => setMarkdownContent(e.target.value)}
                      placeholder="Введите ваш Markdown текст здесь..."
                      className="h-full font-mono text-sm resize-none"
                    />
                  </TabsContent>

                  <TabsContent value="preview" className="h-full m-0 p-3">
                    {isLoading && (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/30 border-t-primary"></div>
                          <FileText className="h-6 w-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">Генерация PDF...</p>
                      </div>
                    )}

                    {error && (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-md">
                          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
                            <FileText className="h-6 w-6 text-destructive" />
                          </div>
                          <p className="text-sm font-semibold text-destructive mb-1">Ошибка генерации</p>
                          <p className="text-xs text-muted-foreground">{error}</p>
                        </div>
                      </div>
                    )}

                    {pdfData && !isLoading && !error && (
                      <div className="h-full border-2 rounded-lg overflow-hidden bg-muted/30">
                        <iframe
                          src={`data:application/pdf;base64,${pdfData}#view=FitH&toolbar=0&navpanes=0`}
                          className="w-full h-full"
                          title="PDF Preview"
                          style={{ minHeight: 0 }}
                        />
                      </div>
                    )}

                    {!pdfData && !isLoading && !error && (
                      <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg bg-muted/30">
                        <div className="text-center">
                          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-sm font-medium text-muted-foreground">PDF появится здесь</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right: Settings Panel */}
          <div className="flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b flex-none">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Настройки
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-3 space-y-2.5">
                <div>
                  <Label htmlFor="font-family" className="text-xs">Шрифт</Label>
                  <Select value={settings.font_family} onValueChange={(value) => updateSetting('font_family', value)}>
                    <SelectTrigger className="mt-1 h-7 text-xs">
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

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label htmlFor="font-size" className="text-xs">Размер</Label>
                    <Input
                      id="font-size"
                      type="number"
                      value={settings.font_size}
                      onChange={(e) => updateSetting('font_size', parseInt(e.target.value) || 12)}
                      min="8"
                      max="24"
                      className="mt-1 h-7 text-xs"
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
                      className="mt-1 h-7 text-xs"
                    />
                  </div>
                </div>

                <Separator className="my-1.5" />

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label htmlFor="text-color" className="text-xs">Текст</Label>
                    <Input
                      id="text-color"
                      type="color"
                      value={settings.text_color}
                      onChange={(e) => updateSetting('text_color', e.target.value)}
                      className="mt-1 h-7 w-full cursor-pointer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bg-color" className="text-xs">Фон</Label>
                    <Input
                      id="bg-color"
                      type="color"
                      value={settings.background_color}
                      onChange={(e) => updateSetting('background_color', e.target.value)}
                      className="mt-1 h-7 w-full cursor-pointer"
                    />
                  </div>
                </div>

                <Separator className="my-1.5" />

                <div>
                  <Label className="text-xs mb-1.5 block">Отступы (pt)</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      type="number"
                      placeholder="Верх"
                      value={settings.margin_top}
                      onChange={(e) => updateSetting('margin_top', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Низ"
                      value={settings.margin_bottom}
                      onChange={(e) => updateSetting('margin_bottom', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Лево"
                      value={settings.margin_left}
                      onChange={(e) => updateSetting('margin_left', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Право"
                      value={settings.margin_right}
                      onChange={(e) => updateSetting('margin_right', parseInt(e.target.value) || 72)}
                      min="0"
                      max="144"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
