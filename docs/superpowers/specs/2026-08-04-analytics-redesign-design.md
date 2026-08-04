# Redesign da tela /analytics

**Data:** 2026-08-04
**Escopo:** `app/(tabs)/analytics.tsx`, `src/hooks/useAnalytics.ts`, `src/utils/periods.ts`, `src/utils/analyticsAgg.ts`, componentes `Analytics*` / `Muscle*Chart`, duas queries em `src/db/queries.ts`. Sem migração de schema.

## Problema

A tela mistura duas noções de tempo. O gráfico mostra os últimos N buckets da granularidade
(8 semanas, 6 meses…), enquanto resumo, frequência por grupo muscular e séries por grupo
muscular olham apenas o **período de calendário corrente**. Em 04/08, "Mês" significa uma
janela de quatro dias: a seção "Grupos musculares" fica em "No data yet" e o resumo compara
quatro dias de agosto com julho inteiro.

Além disso o gráfico responde à pergunta errada em cada granularidade: com o toggle em
"Semana" ele mostra oito semanas, quando o que interessa é o que aconteceu em cada dia
da semana; com o toggle em "Mês" ele mostra tonelagem por mês, quando o que orienta o
treino é quantas séries por semana cada grupo muscular recebeu.

## Decisões

1. **Janela rolling de semanas completas** para toda a tela — resumo incluído.
2. **Gráfico adaptativo**: "Volume por semana" vira volume por **dia** na visão Semana e sai de
   cena nas visões longas da musculação, onde a lista de séries por grupo muscular responde
   melhor. A seção de séries fica visível nas quatro granularidades (totais crus na Semana,
   média semanal nas visões longas).
3. **"Grupos musculares" vira frequência semanal** (`2.0×/sem`), métrica distinta das séries.
4. **Records em acordeão por grupo muscular**, um grupo aberto por vez.
5. **Resumo de musculação com dois tiles** — Volume e Treinos; "Carga máx" sai.

## 1. Janelas de tempo (`src/utils/periods.ts`)

Novo helper, semanas Seg–Dom em ordem cronológica:

```ts
const WINDOW_WEEKS: Record<Granularity, number> = { week: 1, month: 4, semester: 26, year: 52 };

/** Semanas Seg–Dom da janela de análise. Para `week` é a semana corrente (parcial);
 *  para as demais são as N últimas semanas COMPLETAS, terminando no domingo anterior
 *  à semana corrente. */
export function analysisWeeks(g: Granularity, refISO: string): DateRange[];

/** Intervalo coberto por analysisWeeks(): { start: 1ª segunda, end: último domingo }. */
export function analysisRange(g: Granularity, refISO: string): DateRange;

/** As N semanas imediatamente anteriores à janela — base do "vs período anterior". */
export function previousAnalysisRange(g: Granularity, refISO: string): DateRange;
```

Semanas **completas** porque a semana em curso dilui a média: numa terça-feira ela contribui
com ~1 treino de 4 e derruba o valor em ~20%. A semana corrente continua visível — é
exatamente o que a visão "Semana" mostra.

Casos de borda:

- `week` devolve a semana corrente inteira (Seg–Dom), mesmo com dias no futuro; os dias
  sem registro aparecem como barra vazia.
- Instalação nova, sem nenhuma semana completa: `analysisWeeks` devolve a semana corrente
  para qualquer granularidade, e a legenda diz "semana atual".
- `analysisWeeks` nunca devolve array vazio.

`periodRange`, `previousPeriodRange` e `trendBuckets` continuam existindo: `trendBuckets`
ainda alimenta as barras por bucket das modalidades de endurance nas visões longas.

## 2. Seção adaptativa (`AnalyticsTrend.tsx`)

O componente passa a escolher o conteúdo por categoria de modalidade × granularidade:

| | Semana | Mês / Semestre / Ano |
|---|---|---|
| Musculação | `Volume por dia` — 7 barras | *(não renderiza — a seção de séries ocupa o lugar)* |
| Endurance | `Distância por dia` — 7 barras | barras por bucket (comportamento atual) |

### Barras por dia

Sete barras rotuladas `S T Q Q S S D` (Seg→Dom), valor = volume do dia (`Σ reps × carga`)
para musculação, distância do dia para endurance. Dia sem registro fica sem barra. O rótulo
de valor aparece sobre a barra de **hoje**, não sobre a última.

`TrendBars` ganha duas props opcionais — `onBarPress?: (index: number) => void` e
`highlightIndex?: number` — e envolve cada barra num `Pressable` só quando `onBarPress`
existe. O `Pressable` recebe `onPress` **e** `onLongPress` disparando o mesmo handler:
long-press com mouse no navegador é pouco descobrível, e o toque não competia com nenhum
outro gesto ali. As demais chamadas de `TrendBars` seguem inalteradas.

### Detalhe do dia (`DayBreakdownModal.tsx`)

Abre no press/long-press de uma barra com registro (barra vazia não é pressionável).
Lista, para o dia escolhido, uma linha por exercício: nome, nº de séries e volume
(`3 séries · 2.7 t`) — ou distância/tempo nas modalidades de endurance. Rodapé com o total
do dia. Ordena pela ordem do exercício na sessão (`session_exercises."order"`), caindo para
volume decrescente quando a ordem for nula. Fecha com backdrop ou botão, no padrão de
`AppModal.tsx` — nada de `Alert.alert`.

O breakdown sai dos sets **já carregados** pelo hook; não há query nova por toque.

### Séries por grupo muscular (seção própria, sempre visível na musculação)

Reaproveita `getMuscleSeriesInRange` por semana + `averageMuscleSeriesPerWeek(weeklyRaw,
weeks.length)`, agora sobre `analysisWeeks` em vez de `weeksInRange(cur)`. Uma linha por
grupo muscular, ordenada decrescente.

- Semana → totais crus da semana (`12 séries`), via `toMuscleSeriesRows`.
- Mês/Semestre/Ano → média semanal com uma decimal e sufixo `séries/sem`.

Legenda: `últimas 4 semanas · 06/07 – 02/08` / `semana atual · 03/08 – 09/08`.

A seção existe nas quatro granularidades. Não há duplicação: nas visões longas o gráfico de
barras da musculação não é renderizado, e na visão Semana as barras mostram volume por dia —
pergunta diferente da de séries por grupo.

## 3. Frequência semanal (`MuscleBarList.tsx`)

`MuscleFrequencyChart` e `MuscleSeriesChart` são quase idênticos e ambos só têm um call
site. Os dois saem e entra um `MuscleBarList` presentacional:

```ts
interface MuscleBarListProps {
  rows: { muscle_group: string; value: number }[];
  caption?: string;                       // "últimas 4 semanas · 06/07 – 02/08"
  formatValue: (value: number) => string; // "10.2 séries/sem" | "2.0×/sem"
  emptyText?: string;
}
```

Rótulos via `muscleGroupLabel` (hoje o gráfico de frequência faz `replace(/_/g, " ")` cru,
fora do padrão do resto do app). `MuscleSeriesSessionCard` não é tocado.

A seção "Grupos musculares" passa a mostrar **frequência semanal**: treinos distintos em que
o grupo apareceu ÷ nº de semanas da janela (`Legs 2.0×/sem`). Na visão Semana mostra a
contagem crua da semana (`2×`). Novo util:

```ts
/** Frequência por grupo muscular: sessões distintas que trabalharam o grupo ÷ weekCount.
 *  weekCount === 1 devolve a contagem crua (isAverage: false). */
export function weeklyMuscleFrequency(
  sets: AnalyticsSetRow[],
  weekCount: number
): MuscleFrequencyRow[];
```

`MuscleFrequencyRow` (novo, em `src/types/analytics.ts`): `{ muscle_group: string; value:
number; weeks: number; isAverage: boolean }` — mesma forma de `MuscleSeriesRow`, tipo
próprio porque a unidade é outra. Isso substitui o `muscleFrequency()` local de
`useAnalytics.ts`, que hoje conta sessões sem normalizar por semana.

## 4. Records em cascata (`RecordsByMuscleGroup.tsx`)

`getStrengthRecords` passa a devolver os grupos musculares **atuais** do exercício, via
subquery escalar em `exercise_muscle_groups` (escalar, não JOIN — um JOIN duplicaria as
linhas de record):

```sql
(SELECT GROUP_CONCAT(emg.muscle_group)
   FROM exercise_muscle_groups emg
  WHERE emg.exercise_id = st.exercise_id) AS muscle_groups_csv
```

Config atual e não o snapshot da sessão, de propósito: um record é o melhor de todos os
tempos daquele exercício, e deve aparecer sob o grupo ao qual o exercício pertence hoje.

Agrupamento em JS (`groupRecordsByMuscle`): grupos ordenados por nº de records
decrescente, exercício com dois grupos aparece nos dois, grupo sem record é omitido,
records sem grupo nenhum vão para "Sem grupo".

Comportamento do acordeão: todos fechados no primeiro render; tocar num grupo abre e
fecha o anterior; cabeçalho com o label do grupo, contagem (`5 exercícios`) e chevron.
Aberto, renderiza `RecordCard` por exercício ordenado por carga decrescente, **sem** o
limite de 5 de hoje, cada um navegando para `/exercises/[id]`. O selo `NOVO` usa a janela
rolling ativa.

Records de distância (`buildDistanceCards`) ficam exatamente como estão — endurance não
tem grupo muscular para cascatear.

## 5. Resumo (`AnalyticsSummary.tsx`)

Musculação fica com dois tiles, **Volume** e **Treinos**, lado a lado. `maxWeight` sai de
`StrengthSummary`, de `sumStrength()` e dos testes — o dado já vive na seção de records,
melhor apresentado. Endurance mantém os três tiles.

Corrente e anterior passam a vir de `analysisRange` / `previousAnalysisRange`: em "Mês",
últimas 4 semanas completas vs as 4 anteriores. O texto de apoio deixa de ser fixo
("vs período anterior") e diz o que está comparando: `últimas 4 semanas vs 4 anteriores`.

## 6. `useAnalytics.ts`

A superfície do hook depois da mudança:

```ts
interface AnalyticsView {
  modality; granularity; setModality; setGranularity; refresh;

  strengthCurrent; strengthPrevious;      // sem maxWeight
  distanceCurrent; distancePrevious;

  /** Janela ativa: intervalo, nº de semanas e legenda pronta para UI.
   *  Não se chama `window` para não sombrear o global do navegador. */
  analysisWindow: { range: DateRange; weekCount: number; label: string };

  /** Visão Semana: 7 dias Seg–Dom. `value` = volume (kg) ou distância (km). */
  dayBars: { dateISO: string; label: string; value: number; hasData: boolean }[];
  /** Breakdown por exercício de um dia, a partir dos sets já carregados. */
  dayBreakdown: (dateISO: string) => DayExerciseBreakdown[];
  // DayExerciseBreakdown (novo, em src/types/analytics.ts):
  //   { exercise_id: number; exercise_name: string; setCount: number;
  //     volume: number; distanceKm: number | null; durationSec: number | null }
  // Valores canônicos (kg, km, s); a formatação por modalidade fica no modal.

  /** Visões longas de endurance: barras por bucket (comportamento atual). */
  trend: { label: string; value: number }[];

  muscleSeries: MuscleSeriesRow[];        // séries/semana na janela
  muscleFreq: MuscleFrequencyRow[];       // ×/semana na janela
  recordsByGroup: { muscle_group: string; records: StrengthRecord[] }[];
  distanceRecords: DistanceRecords;

  streak; streakDates;
}
```

Um único `getSetsInRange` continua servindo resumo, barras diárias, breakdown e frequência.
`fetchStart` passa a ser o menor entre o início da janela, o início da janela anterior e o
primeiro bucket (este último só importa para endurance). `getStrengthRecords` e
`getSessionDatesByModality` seguem iguais.

`getSetsInRange` ganha um campo: `exercise_order`, por subquery escalar em
`session_exercises."order"` — `"order"` é palavra reservada e vai citado. É escalar pelo
mesmo motivo já documentado na query: um JOIN fanaria a linha por grupo muscular e
inflaria os somatórios de volume.

## Testes

- `periods.test.ts` — `analysisWeeks` / `analysisRange` / `previousAnalysisRange`: contagem
  por granularidade, exclusão da semana corrente, virada de mês e de ano, refISO num
  domingo e numa segunda, fallback de instalação nova.
- `analyticsAgg.test.ts` — barras diárias (dia vazio no meio da semana, dia fora da janela
  ignorado), `weeklyMuscleFrequency` (`weekCount: 1` cru vs média, sessão com exercício
  multi-grupo contando uma vez por grupo), `sumStrength` sem `maxWeight`.
- Novo `src/utils/analyticsRecords.test.ts` — `groupRecordsByMuscle`: exercício
  multi-grupo em dois grupos, ordenação por nº de records, record sem grupo, lista vazia.
- `queries.test.ts` — `getSetsInRange`: grupos musculares do snapshot, uma linha por set
  (sem fan-out) e `exercise_order`.
- `npx tsc --noEmit` e `npx eslint .` limpos.
- Verificação manual no navegador (`npx expo start --web`): toggle nas quatro
  granularidades em musculação e numa modalidade de endurance, press e long-press numa
  barra de dia, abrir/fechar dois grupos de records em sequência, e conferir à mão
  `séries/sem` de um grupo contra as sessões da janela.

## Fora de escopo

Escolher janelas customizadas, navegar para períodos passados, metas de séries por grupo
muscular, gráfico de séries ao longo do tempo e qualquer alteração no schema.
