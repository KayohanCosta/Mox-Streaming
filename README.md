# MOX Streaming

Aplicação de descoberta e reprodução de filmes, séries, animes, doramas e novelas. A interface usa metadados e imagens do TMDB, com perfis locais, lista pessoal, histórico de reprodução, seleção de episódios e uma área de TV. O repositório contém também um **experimento local** de catálogo e reprodução baseado em referências públicas do addon BrazucaPlay.

> **Estado da reprodução:** catálogo e vídeo são coisas diferentes. Um título aparecer no MOX não confirma que exista uma mídia reproduzível. A experiência local do addon exige o serviço Python em `127.0.0.1:8791`; ele não é incluído no build da Vercel. A implantação atual usa a API do Supabase para dados de catálogo, mas a reprodução de mídia na nuvem ainda depende de um serviço compatível validado. Consulte [limitações e testes do addon](tools/ADDON-CATALOG.md) e [estado do Supabase](supabase/README.md).

## Como o projeto está organizado

| Parte | Função | Execução |
| --- | --- | --- |
| `src/` | Site React, navegação, player, perfis e páginas | Vite / Vercel |
| `src/lib/tmdb.ts` | Metadados, títulos, capas e episódios | Navegador |
| `src/lib/redecanais.ts` | Contrato da API de reprodução e erros | Navegador + API configurada |
| `supabase/functions/mox-api/` | API publicada de catálogo e resposta explícita para vídeo não disponível | Supabase |
| `supabase/functions/mox-catalog-sync/` | Sincronização limitada do catálogo | Supabase |
| `tools/addon_*.py` | Importação, busca e teste local de fontes do addon | Python local |
| `.local/addon-catalog/` | Índices gerados, fora do Git | Somente máquina local |

As rotas principais são `/`, `/category/:category`, `/details/:type/:id`, `/search`, `/my-list` e `/tv`. A rota `/acervo` aparece somente em desenvolvimento com `VITE_ADDON_LOCAL_TEST=1`.

## Começar no computador

Requisitos: Node.js compatível com o projeto, npm e Python 3 para o experimento do addon.

```sh
git clone https://github.com/KayohanCosta/Mox-Streaming.git
cd Mox-Streaming
npm install
cp .env.example .env
npm run dev
```

Abra o endereço informado pelo Vite. A porta padrão configurada é `8080`; `npm run dev -- --port 8081` usa `8081`.

Para testar o addon localmente, em terminais separados:

```sh
python3 tools/addon_sync.py
python3 tools/addon_local_server.py
VITE_ADDON_LOCAL_TEST=1 npm run dev -- --port 8081 --strictPort
```

Abra `http://localhost:8081/acervo`. O serviço Python atende apenas em `127.0.0.1:8791`, e o Vite repassa as chamadas `/addon-local` para ele. A sincronização cria os índices em `.local/addon-catalog/`; esses arquivos são gerados, não versionados. Há detalhes de cobertura, famílias de fonte e títulos efetivamente testados em [tools/ADDON-CATALOG.md](tools/ADDON-CATALOG.md).

### Configuração

| Variável | Uso |
| --- | --- |
| `VITE_CATALOG_API_URL` | API de catálogo do Supabase; há um valor de exemplo em `.env.example`. |
| `VITE_PLAYBACK_API_URL` | API pública de reprodução, **somente quando validada**. |
| `VITE_ADDON_LOCAL_TEST=1` | Habilita rotas e proxy locais do addon em desenvolvimento; não habilita o addon no build de produção. |

Variáveis `VITE_` ficam expostas no JavaScript enviado ao navegador. Não coloque nelas cookies, tokens privados ou chaves de serviço. Arquivos `.env*` locais e `.local/` são ignorados pelo Git.

## Disponibilidade e reprodução

- A busca e as capas vêm do TMDB ou dos índices de catálogo. Isso **não** equivale a uma mídia confirmada.
- No teste local, uma série só é associada a uma fonte do addon quando a referência do índice ou uma busca por título e ano exatos fornece episódios. Uma referência vencida pode ser procurada novamente. Se não houver fonte, os detalhes mostram “Indisponível no momento”.
- Filmes com `movie2` e episódios com `serie3` usam um resolvedor local que valida uma resposta parcial MP4 antes de informar a fonte. URLs temporárias são obtidas novamente quando necessário. Outras famílias de referências do addon não foram integradas como mídia reproduzível.
- A seção TV apresenta os canais encontrados no índice do addon, mas **nenhum canal desse índice foi confirmado como reproduzível no navegador**. O catálogo de canais não é uma lista IPTV funcional.
- O build da Vercel não executa Python nem contém os índices gerados localmente. Portanto, publicar o frontend não disponibiliza automaticamente o acervo ou a reprodução do addon na internet.

Para não exibir um erro transitório, a tela do player espera a consulta inicial de disponibilidade. “Tentar novamente” refaz a consulta quando a listagem de episódios falha. Um título comprovadamente ausente do addon aparece como indisponível sem precisar abrir o player.

## Testes e build

```sh
npm test -- --run
npm run build
python3 -m unittest discover -s tools -p 'test_addon*.py'
```

O build fica em `dist/`. Os testes do site verificam navegação, catálogo, player e progresso; os testes Python verificam parsing, referências e o fallback de episódios. Testes automatizados não substituem uma sessão real de reprodução. Os títulos já validados, com o escopo exato de cada teste, estão no documento do addon.

## Publicação

`vercel.json` configura o build Vite, a pasta `dist` e o fallback das rotas do React. O projeto Vercel associado ao repositório publica o frontend. A API do Supabase é uma implantação separada: suas funções, esquema e limitações estão em [supabase/README.md](supabase/README.md). Não configure `VITE_PLAYBACK_API_URL` para um endereço que só funciona na sua máquina.

## Dados, fontes e licença

TMDB fornece metadados e imagens; não fornece os arquivos de vídeo. Referências de fonte podem sair do ar ou exigir uma sessão que não possa ser transferida. O importador não guarda credenciais do addon no repositório. Use fontes e distribuição de mídia apenas quando houver direito de acesso e uso.

Este repositório não contém um arquivo `LICENSE`; nenhum tipo de licença é afirmado aqui até que o proprietário escolha e publique um.
