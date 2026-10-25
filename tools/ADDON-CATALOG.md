# Acervo e reprodução local do MOX

Este experimento lê os índices públicos referenciados pelo BrazucaPlay sem
executar o addon original nem usar suas credenciais embutidas. A reprodução
usa somente rotas públicas que foram adaptadas e testadas separadamente.

## Iniciar

Na raiz do projeto, em terminais separados:

```sh
python3 tools/addon_sync.py
python3 tools/addon_local_server.py
VITE_ADDON_LOCAL_TEST=1 npm run dev -- --port 8081 --strictPort
```

Abra `http://localhost:8081/acervo` para pesquisar, filtrar e navegar pelo
catálogo; `http://localhost:8081/tv` carrega os canais diretamente do índice
público do addon, sem pedir uma lista M3U. O serviço de reprodução escuta apenas em `127.0.0.1:8791`,
e o Vite também fica restrito ao loopback neste modo. O build publicado não
inclui o serviço Python.

Na TV, os canais aparecem em uma faixa horizontal. O índice público do addon
continha 452 variantes em cada uma de duas opções de servidor. O importador
deduplicou nomes, agrupou as variantes de qualidade e exibiu 96 canais após
limitar os canais abertos regionais a Fortaleza. Categorias são derivadas dos
grupos do índice. O seletor mostra no máximo duas opções de qualidade por
canal, priorizando 720p e 1080p e usando a variante baixa quando faltar uma
delas. A referência `chresolver1` é um identificador de resolvedor protegido,
não um link de vídeo. Nenhuma transmissão desse índice foi confirmada no
navegador; todos aparecem com indisponibilidade explícita.

## Cobertura observada em 25/10/2026

| Índice | Entradas importadas |
| --- | ---: |
| Filmes | 17.958 |
| Séries | 8.280 |
| Novelas | 563 |
| Doramas | 2.686 |
| Animes | 2.367 |
| Total | 31.854 |

31.670 entradas têm ID TMDB e aparecem na busca local. Elas são registros de
catálogo, não uma contagem de vídeos reproduzíveis. Os arquivos importados
ficam em `.local/addon-catalog/`, fora do Git. A página de acervo usa apenas
capas do TMDB quando disponíveis; nenhuma capa importada da origem é exibida.

O resolvedor `movie2` tem referência para 6.729 IDs TMDB únicos de filmes.
O resolvedor `serie3` tem 2.297 IDs TMDB entre séries, novelas, doramas e
animes no índice local. Para uma série ausente desse índice, a API local
consulta a busca pública da mesma origem do addon, exige título e ano exatos
e confirma a lista de episódios antes de associar a referência ao ID TMDB.
Esses números são **candidatos**: cada vídeo temporário ainda precisa ser
validado no momento de uso. As demais famílias de fontes do addon não têm
resolvedor integrado.

## Reprodução validada

- **Matrix (1999)**, filme TMDB 603: o MP4 respondeu a requisições de
  intervalo (`206 video/mp4`) e avançou no player web. No teste local com a
  origem já preparada, a retomada começou a reproduzir em 2,34 s após o
  clique. Esta medição não garante menos de 5 s para todos os títulos ou
  conexões; a obtenção inicial da fonte pode ser mais lenta.
- **Band of Brothers**, série TMDB 4613: episódio 1 abriu no player; ao
  alcançar o final, o episódio 2 iniciou automaticamente e avançou. Isso
  valida este par de episódios, não a série inteira.
- **Cyberpunk: Mercenários**, série TMDB 105248, e **Among Us** (2026),
  série TMDB 229544: ausentes do índice local, foram encontrados pela busca
  exata; os primeiros episódios responderam `206 video/mp4` e avançaram no
  player web.
- **IPTV**: a tela lê o catálogo do addon sem M3U, mas nenhum dos canais
  importados possui uma mídia direta validada. A seção Pluto TV do addon
  também foi examinada: a API listou 181 canais; a URL HLS testada respondeu
  `401`, portanto não foi integrada como reprodução funcional.

O serviço prepara o início e o fim do MP4 em segundo plano ao abrir os
detalhes. Isso reduz a espera em fontes que precisam ler metadados no fim do
arquivo. Não remove a necessidade de resolver a URL temporária, nem torna
reproduzível uma fonte indisponível.

Na TV, o módulo HLS pode ser carregado antes da sintonia, e a janela de buffer
do player foi ampliada para reduzir pausas quando uma origem válida permite.
Isso não torna reproduzível um resolvedor protegido ou um servidor instável.

## Verificação

```sh
python3 -m unittest discover -s tools -p 'test_addon*.py'
npx tsc --noEmit
npm run build
npm test -- --run src/lib/iptv.test.ts src/components/IPTVPlayer.test.tsx
```

O experimento é local e depende de um processo Python persistente. Ele não é
uma API implantada no Supabase ou na Vercel, e não demonstra funcionamento
de todo o acervo nesses ambientes.
