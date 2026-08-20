# Fixtures

Fixtures sao **imutaveis**. Nenhum arquivo daqui e editado no lugar: precisou
de outro caso, e arquivo novo com nome novo. O verdict de um asset so tem
sentido se o asset nao muda debaixo do teste.

## Validos — glTF-Sample-Assets da Khronos

Baixados de `KhronosGroup/glTF-Sample-Assets` no commit
`bf2bb4a81c73a7ceb53e80df3dec0105c5a3fdef`, com sha256 conferido na hora do
download por `scripts/fetch-khronos.mjs`.

| Arquivo | Origem | Bytes | sha256 | Licenca |
|---------|--------|-------|--------|---------|
| `valido.glb` | `Models/Box/glTF-Binary/Box.glb` | 1664 | `ed52f7192b8311d700ac0ce80644e3852cd01537e4d62241b9acba023da3d54e` | CC BY 4.0, (c) 2017 Cesium |
| `valido-textura.glb` | `Models/BoxTextured/glTF-Binary/BoxTextured.glb` | 5956 | `b510eca2e2ef33f62f9ed57d6e7ce2d10ebb2bdebc4a8e59d347719ba81abdf4` | CC BY 4.0, (c) 2017 Cesium |

`valido-textura.glb` usa o logo da Cesium como textura — atribuicao acima, como
a CC BY 4.0 pede. Ele existe para exercitar o caminho de recursos e imagem do
validator, que `valido.glb` (sem textura) nao cobre.

Os dois passam limpos: zero erros, zero avisos, zero infos.

## Quebrado — gerado

| Arquivo | Bytes | sha256 |
|---------|-------|--------|
| `quebrado.glb` | 1612 | `641449b12c1f7f27c232c4586e4746374396f90fb5b085396671e5edcba96fe1` |

Produzido por `scripts/make-quebrado.mjs` a partir de `valido.glb`. O container
GLB continua bem formado — o defeito e semantico, para o validator conseguir
chegar ate o conteudo e devolver violacao legivel:

| Defeito | Codigo esperado | Pointer |
|---------|-----------------|---------|
| `attributes.POSITION` aponta pro accessor 99 | `UNRESOLVED_REFERENCE` | `/meshes/0/primitives/0/attributes/POSITION` |
| `bufferViews[0]` sem a propriedade `buffer` | `UNDEFINED_PROPERTY` | `/bufferViews/0` |
| `primitives[0].mode` como string | `TYPE_MISMATCH` | `/meshes/0/primitives/0/mode` |

Sai tambem um `UNUSED_OBJECT` de severidade Information, que o perfil
`web-commerce` filtra (`report: "warn"`).

## Comandos

```bash
pnpm fixtures:fetch          # rebaixa os validos e confere o sha256
node fixtures/scripts/fetch-khronos.mjs --check   # so confere o que esta em disco
pnpm fixtures:broken         # regera quebrado.glb (deterministico, mesmo sha256)
```
