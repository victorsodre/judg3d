# @judg3d/mcp

Placeholder. Sem codigo ainda — o pacote existe para reservar o nome e o lugar
no workspace.

## O que vai morar aqui

O MCP server que coloca o juiz dentro do loop do Claude Code / Cursor, com as
ferramentas que a spec define:

| Ferramenta | O que faz |
|------------|-----------|
| `judge_asset` | Julga um arquivo local contra um profile |
| `judge_url` | Julga um asset remoto |
| `render_views` | Renderiza as N views deterministicas (depende de L4) |
| `approve_baseline` | Promove os renders atuais a baseline (depende de L4) |

## Por que ainda esta vazio

`judge_asset` ja daria pra escrever hoje em cima de `@judg3d/judge`, mas as
outras tres dependem do rasterizador de software que entra na camada VISUAL.
Publicar um server que expoe uma ferramenta e promete tres seria pior do que
nao publicar.
