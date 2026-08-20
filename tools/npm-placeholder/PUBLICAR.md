# Placeholder do npm

Este diretório é o artefato **exato** publicado como `judg3d@0.0.1` em
2026-08-20, não uma reconstrução aproximada. Ele existe só para travar o nome
no registry enquanto a versão utilizável não sai.

Fica fora de `packages/*`, então não entra no workspace pnpm, no `tsc --build`
nem no `pnpm test`. Este arquivo não vai no tarball (o `files` do
`package.json` lista só `bin.js` e `README.md`).

| | |
|---|---|
| Nome | `judg3d` |
| Versão publicada | `0.0.1` |
| shasum do tarball | `4098127e5d18bbcae56b9aeb637be1d63bbb2663` |
| Tamanho | 584 B, 3 arquivos |
| Mantenedor | `ovictor` |

## Publicar a próxima

```bash
cd tools/npm-placeholder
npm pack --dry-run          # confere o conteúdo antes
npm publish --otp=<6 dígitos>
```

A conta tem 2FA em `auth-and-writes`, então **todo publish exige OTP**.

## Armadilhas já pagas — não repetir

- **`"bin": { "judg3d": "./bin.js" }` não funciona.** O npm descarta a entrada
  em silêncio (`"bin[judg3d]" script name bin.js was invalid and removed`) e o
  `npx judg3d` não faz nada. Sem o `./` funciona. Sempre conferir com
  `npm pack --dry-run` se o warn aparece.
- **Nunca publicar `packages/cli` como placeholder.** As dependências
  `workspace:*` viram `@judg3d/core@0.0.0` e `@judg3d/judge@0.0.0` no tarball,
  que não existem no registry — o pacote não instala. O placeholder é
  deliberadamente autossuficiente, zero dependências.

## Quando o repo virar público (semana 3)

Publicar `0.0.2` com o link do repositório no README e o campo `repository` no
`package.json`. Hoje ficou sem link de propósito: apontar para um repo privado
daria 404 para quem viesse do npm.

A primeira versão utilizável sai como `0.1.0`, aí sim a partir de
`packages/cli` e com `@judg3d/core` e `@judg3d/judge` publicados antes.
