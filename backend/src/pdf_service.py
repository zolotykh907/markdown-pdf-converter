import markdown
import weasyprint
from typing import Dict, Any


def get_css_font_family(font_family: str) -> str:
    font_mapping = {
        'Inter': 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'Arial': 'Arial, sans-serif',
        'Helvetica': 'Helvetica, Arial, sans-serif',
        'Times-Roman': 'Times, "Times New Roman", serif',
        'Courier': 'Courier, "Courier New", monospace',
        'Georgia': 'Georgia, "Times New Roman", serif',
        'Verdana': 'Verdana, Arial, sans-serif'
    }
    
    return font_mapping.get(font_family, 'Arial, sans-serif')


def create_pdf_from_markdown(markdown_content: str, settings: Dict[str, Any]) -> bytes:
    
    css_font_family = get_css_font_family(settings['font_family'])
    
    html_content = markdown.markdown(markdown_content, extensions=['tables', 'fenced_code'])
    
    full_html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Markdown to PDF</title>
        <style>
            @page {{
                size: A4;
                margin: {settings['margin_top']}pt {settings['margin_right']}pt {settings['margin_bottom']}pt {settings['margin_left']}pt;
            }}
            
            body {{
                font-family: {css_font_family};
                font-size: {settings['font_size']}pt;
                line-height: {settings['line_height']};
                color: {settings['text_color']};
                background-color: {settings['background_color']};
                margin: 0;
                padding: 0;
            }}
            
            h1 {{
                font-size: {settings['font_size'] * 2}pt;
                font-weight: bold;
                margin: 18pt 0 12pt 0;
                color: {settings['text_color']};
            }}
            
            h2 {{
                font-size: {settings['font_size'] * 1.5}pt;
                font-weight: bold;
                margin: 14pt 0 10pt 0;
                color: {settings['text_color']};
            }}
            
            h3, h4, h5, h6 {{
                font-size: {settings['font_size'] * 1.25}pt;
                font-weight: bold;
                margin: 12pt 0 8pt 0;
                color: {settings['text_color']};
            }}
            
            p {{
                margin: 0 0 12pt 0;
                text-align: justify;
            }}
            
            ul, ol {{
                margin: 0 0 12pt 0;
                padding-left: 20pt;
            }}
            
            li {{
                margin: 0 0 6pt 0;
            }}
            
            code {{
                font-family: 'Courier New', Courier, monospace;
                background-color: #f5f5f5;
                padding: 2pt 4pt;
                border-radius: 3pt;
            }}
            
            pre {{
                font-family: 'Courier New', Courier, monospace;
                background-color: #f5f5f5;
                padding: 12pt;
                border-radius: 6pt;
                overflow-x: auto;
                margin: 12pt 0;
            }}
            
            blockquote {{
                margin: 12pt 0;
                padding-left: 20pt;
                border-left: 4pt solid #ddd;
                font-style: italic;
            }}
            
            table {{
                border-collapse: collapse;
                width: 100%;
                margin: 12pt 0;
            }}
            
            th, td {{
                border: 1pt solid #ddd;
                padding: 8pt;
                text-align: left;
            }}
            
            th {{
                background-color: #f5f5f5;
                font-weight: bold;
            }}
        </style>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    try:
        html_doc = weasyprint.HTML(string=full_html)
        
        pdf_bytes = html_doc.write_pdf()
        
        return pdf_bytes
        
    except Exception as e:
        print(f"Error when creating pdf: {e}")
        raise e
