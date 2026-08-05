# Detalhe por exercício dentro do grupo muscular

Tocar numa linha do painel "Carga por grupo muscular" (`/analytics`) expande a lista
dos exercícios que produziram aquela carga na janela selecionada. Vale para todas as
janelas (semana, mês, semestre, ano), análogo ao detalhe do dia que já existe no
gráfico de volume semanal.

## Problema

O painel diz *quanto* cada grupo recebeu e *com que frequência*, mas não *de onde* a
carga veio. Um peitoral com 18 séries/semana concentradas num único supino é um
treino diferente de 18 distribuídas em três movimentos, e hoje a única forma de
descobrir isso é abrir sessão por sessão no feed.

## Dados

Uma query nova em `src/db/queries.ts`, com o mesmo JOIN pelo snapshot que
`getMuscleSeriesInRange` usa, quebrada também por exercício:

```sql
SELECT sm.muscle_group, st.exercise_id, e.name AS exercise_name,
       SUM(sm.counting_factor) AS total_series,
       COUNT(st.id)            AS raw_sets,
       COUNT(DISTINCT s.id)    AS session_count
FROM sessions s
JOIN sets st ON st.session_id = s.id
JOIN exercises e ON e.id = st.exercise_id
JOIN session_exercises se ON se.session_id = st.session_id AND se.exercise_id = st.exercise_id
JOIN session_exercise_muscle_groups sm ON sm.session_exercise_id = se.id
WHERE s.modality = ? AND s.date >= ? AND s.date <= ?
GROUP BY sm.muscle_group, st.exercise_id
```

Ler o snapshot (`session_exercise_muscle_groups`), e não a config atual do exercício,
é o mesmo requisito de sempre: re-pesar um exercício hoje não pode mexer na carga de
semanas já treinadas.

**Uma chamada só, no range inteiro da janela**, dividida por `weekCount`. Como
`analysisWeeks()` cobre o range exatamente, isso dá o mesmo número que o painel
obtém somando semana a semana — a soma dos filhos bate com a linha do grupo em
qualquer janela. Essa é a garantia central da tela: 8,0 + 6,0 + 4,0 = 18.

`raw_sets` existe para a marca ½×: o selo aparece quando `total_series < raw_sets`,
que é verdade sempre que algum set entrou com `counting_factor` 0,5 — inclusive no
caso em que a config mudou no meio da janela, que uma leitura de fator único não
cobriria.

`session_count` é a única coisa que **não** é dividida pelo `weekCount`. Rodando com
dados reais numa janela de 26 semanas, um movimento treinado 8 vezes aparecia como
`0,3×` — um número que não se lê, com os pips exibindo apenas um anel vazio. A média
funciona na linha do grupo (`1,8×/sem`); por exercício, a contagem crua ("em 8
sessões") é o que informa, e nada nesse campo precisa somar com o pai.

Agregação em `src/utils/analyticsAgg.ts`, ao lado de `averageMuscleSeriesPerWeek`:

```ts
muscleExerciseBreakdown(raw: MuscleExerciseSeriesRaw[], weekCount: number)
  : Map<string, MuscleExerciseRow[]>
```

Divide séries e frequência por `Math.max(weekCount, 1)`, marca `isAverage` quando o
divisor é maior que 1 (mesma convenção das outras funções do arquivo), calcula
`share` sobre o total de séries do próprio grupo e ordena por séries desc.

Tipos novos em `src/types/analytics.ts`: `MuscleExerciseSeriesRaw` (linha crua do
SQL) e `MuscleExerciseRow` (`exercise_id`, `exercise_name`, `series`, `frequency`,
`share`, `halved`, `weeks`, `isAverage`).

`useAnalytics` busca junto do resto da janela, dentro do `if (isStrengthCategory)`
que já existe, e expõe `muscleBreakdown(group)` — lookup puro no Map memoizado,
igual a `dayBreakdown`. Expandir um grupo não custa query.

## UI

`LoadRow` vira `Pressable` com chevron `▸/▾` à direita do número de séries.
Expandida, a linha revela os exercícios abaixo da barra de placas, indentados e
separados do cabeçalho do grupo por um hairline. Cada linha de exercício traz:

- nome, mais um selo `½×` discreto quando `halved`;
- o número de séries à direita, na mesma tipografia mono do painel;
- embaixo, a mini-barra de participação (largura = `share`) com o percentual, e à
  direita a contagem de sessões da janela ("em 8 sessões").

Entrada em stagger via `FadeInRow`, como o resto do painel.

**A cauda é dobrada, não cortada.** Um grupo real chegou a 21 exercícios numa janela
de semestre — a gaveta aberta virava três telas de rolagem cuja metade final dizia
"0,5 sér/sem, 5%" repetidamente. `splitExerciseRows` (em `utils/muscleLoad.ts`) mantém
os seis maiores e resume o resto numa linha "+ outros N exercícios" que **carrega as
séries deles**. Dobrar em vez de truncar é o requisito: se o resto sumisse, a gaveta
passaria a contradizer o número da linha que a abriu. A linha só aparece quando pelo
menos dois exercícios se dobram — trocar uma linha por uma linha, perdendo o nome, é
um mau negócio.

**Um grupo aberto por vez.** O painel chega a dez grupos; manter vários abertos
destrói a leitura do ranking, que é a razão de ele existir. Trocar `ORDENAR` fecha o
expandido, já que o re-deal reordena tudo de qualquer forma.

A sub-lista vive em `src/components/MuscleExerciseList.tsx`. `AnalyticsMuscleBreakdown.tsx`
já está em ~520 linhas, e a lista é uma unidade própria: recebe rows e slots, não
sabe nada sobre queries ou sobre o grupo que a contém.

## Janelas

- **Semana** (`weekCount === 1`): séries cruas — `3 sér`, "em 1 sessão".
- **Mês / semestre / ano**: séries em média por semana — `1,5 sér/sem` — e a contagem
  de sessões da janela inteira, sem média.

Nenhum caminho especial por janela: `isAverage` vem do mesmo divisor que o painel já
usa. Modalidades de endurance não têm painel, então nada muda lá.

## Testes

`src/utils/analyticsAgg.test.ts` cobre `muscleExerciseBreakdown`:

- divisão pelo `weekCount` e `isAverage` conforme o divisor;
- sessões contadas, nunca divididas;
- soma das séries dos filhos = total do grupo (a garantia central);
- `halved` verdadeiro quando `total_series < raw_sets`, falso quando iguais;
- exercício com dois grupos aparece nos dois, com o crédito de cada um;
- entrada vazia devolve Map vazio, e `share` não divide por zero.

`src/utils/muscleLoad.test.ts` cobre `splitExerciseRows`: lista que já cabe fica
intacta, um único excedente não é dobrado, `head + tail` continua somando o total do
grupo, e lista vazia não gera linha de resto.

`src/db/__tests__/queries.test.ts` cobre `getMuscleExerciseSeriesInRange` contra um
SQLite em memória: quebra por exercício com o peso de cada par, `raw_sets` ≠
`total_series` no par de ½×, escopo de data e modalidade, leitura do snapshot, e a
soma dos filhos comparada diretamente com `getMuscleSeriesInRange`.
