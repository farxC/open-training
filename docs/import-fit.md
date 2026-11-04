# Importação de corridas FIT

Em **Configurações → Importar arquivo .fit**, escolher o arquivo exportado pelo
Zepp ou outro relógio, conferir a prévia e importar como nova corrida ou vincular
a uma sessão do mesmo dia. A vinculação preserva trechos, notas, nome e métricas
manuais. Uma sessão pode ter dados de FIT e Health Connect, exibidos separadamente.

## Contrato

- Funciona no navegador, Android e iOS. Leitura local, sem upload e sem depender
  de permissões do Health Connect.
- Aceita FIT binário de atividade (`file_id.type = activity`) com **uma única
  sessão de corrida**, início/fim válidos e no máximo 20 MB. Arquivos multiesporte,
  rotas e planejamentos são recusados explicitamente.
- Usa `@garmin/fitsdk@21.217.0`, SDK oficial, com validação de assinatura, tamanho e
  CRC antes de decodificar. Erros de decodificação impedem a gravação.
- Converte metros para km e timestamps FIT para UTC. Datas da sessão usam o dia
  local do dispositivo no momento da importação.
- Preserva tempo decorrido e tempo ativo separadamente. O tempo ativo informado
  pelo FIT é usado na duração da sessão e no pace. Sem tempo ativo, não inventa
  pace; a duração da sessão usa o tempo decorrido como alternativa.
- Cadência de corrida FIT é expressa em passadas completas/min. Os campos
  inteiros e fracionários são combinados após aplicar a escala do SDK, depois
  multiplicados por dois **uma única vez**, para passos/min dos dois pés.
- Médias e máximas reportadas no resumo são preservadas. As máximas calculadas
  das amostras são mostradas separadamente. Resumo sem amostras não gera curva.
  Zero real de cadência é preservado; ausência de dados não vira zero.
- As amostras incluem o instante final da corrida; registros externos ao período
  são ignorados. Gráficos não unem lacunas superiores a 60 segundos.

## Voltas e identidade

Voltas com horários válidos ficam no snapshot. Quando formam uma partição
contínua de toda a corrida, viram trechos em `sets` na criação de uma nova sessão.
Voltas parciais ou sobrepostas ficam preservadas no snapshot, e uma única série
com o resumo total evita dupla contagem. Vincular a uma sessão existente não
adiciona nem altera seus trechos.

SHA-256 do conteúdo identifica o mesmo arquivo, independentemente do nome.
Quando o FIT informa fabricante, número de série e data de criação, a identidade
da atividade combina esses campos, produto e início da sessão. Isso permite
reconhecer reexportações que conservem a identidade original. Sem esses campos,
a identidade depende do hash: arquivos diferentes não são considerados iguais
apenas porque têm data ou distância parecidas.

Reimportar uma identidade já vinculada atualiza somente o snapshot de métricas;
preserva nome, notas, distância, duração e trechos editáveis da sessão.
Não há deduplicação automática entre FIT e Health Connect: o usuário escolhe
uma sessão existente quando os dois representam a mesma corrida.

## Persistência e backup

O schema 22 cria `session_fit_imports`, com um vínculo por sessão, UUID, identidade
da atividade e hash únicos. O payload JSON versionado armazena os dados usados
pelo app, resumos, amostras e voltas. O arquivo binário original e suas coordenadas
GPS não são armazenados. Excluir a sessão elimina o vínculo por cascade.

O backup formato 9 inclui o vínculo e todo o snapshot, usando o UUID da sessão
para restauração, sem IDs numéricos entre dispositivos. Backups 7 e 8 continuam
aceitos. Toda gravação ocorre em uma transação; falhas não deixam sessões parciais.

## Validação

As fixtures em `src/fit/__fixtures__/` são sintéticas e podem ser regeneradas
com `node src/fit/__fixtures__/generate.mjs`. Os testes exercitam os binários,
conversões de unidade, amostras, CRC, resumo sem amostras, modalidades recusadas,
reimportação, pausas, voltas, preservação dos dados manuais e backup/restauração.

Referências: [SDK JavaScript oficial da Garmin](https://github.com/garmin/fit-javascript-sdk),
[cadência e demais campos do FIT Zepp](https://devopen.zepp.com/docs/resources/fit-file/fit-spec).
