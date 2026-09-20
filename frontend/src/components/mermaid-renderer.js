let mermaidPromise

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        fontFamily: 'inherit',
        flowchart: { htmlLabels: false },
      })
      return mermaid
    })
  }

  return mermaidPromise
}

export async function renderMermaidSvg(chart, id) {
  const mermaid = await getMermaid()
  return mermaid.render(id, chart)
}
