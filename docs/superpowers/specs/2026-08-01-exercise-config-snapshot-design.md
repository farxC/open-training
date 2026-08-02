# Configuração completa de exercícios de musculação (com snapshot histórico)

## Contexto

Hoje um exercício é parcialmente editável e **nada** é histórico:

- `exercise_config` (1:1) guarda a config física; `session_exercise_config` guarda um **override esparso** por sessão-exercício. Ambos são resolvidos por `COALESCE` em **tempo de leitura** (`getSessionExercises`, `src/db/queries.ts`). Consequência: editar o padrão de um exercício **reescreve como todo o histórico é lido**.
- O mesmo vale para grupos musculares e `counting_factor`: `getMuscleSeriesInRange`/`getMuscleSeriesForSession` fazem JOIN direto em `exercise_muscle_groups`, então mudar um fator recalcula o volume de todas as semanas passadas.
- Só é possível editar config (em `app/exercises/[id].tsx`) e grupos musculares (escondido dentro do `ExercisePickerModal`). **Não existe rename, nem arquivar/excluir.**

O objetivo: poder editar **qualquer coisa** de um exercício de musculação — inclusive o nome — com a regra de que **a config vigente vale para as próximas sessões e o histórico fica congelado**, mais duas dimensões novas (pegada e peso corporal) e a possibilidade de arquivar exercícios.

A mudança arquitetural central é: **resolver-na-leitura → congelar-na-escrita**.

## Decisões

| Decisão | Escolha |
|---|---|
| Histórico | Congelar por snapshot na escrita (ao adicionar o exercício à sessão) |
| Nome | Propaga para o histórico (mesmo exercício, nome melhor) |
| Grupos musculares + `counting_factor` | Congelam por sessão-exercício |
| Granularidade do `counting_factor` | Mantém 0.5 / 1 |
| Dimensões novas | Pegada (tipo + largura) e peso corporal (flag + interpretação da carga) |
| Exclusão | Arquivar (soft-delete), histórico preservado |
| Aplicar retroativamente | Opcional, com confirmação ao salvar |

## Schema — v18

`SCHEMA_VERSION` 17 → 18; `CURRENT_EXPORT_FORMAT_VERSION` 5 → 6.

1. **`exercises.is_archived`** — `INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))`.

2. **`exercise_config` ganha 4 colunas:**

   ```sql
   grip_type  TEXT CHECK (grip_type  IS NULL OR grip_type  IN ('pronated','supinated','neutral','mixed')),
   grip_width TEXT CHECK (grip_width IS NULL OR grip_width IN ('close','medium','wide')),
   uses_bodyweight INTEGER NOT NULL DEFAULT 0 CHECK (uses_bodyweight IN (0, 1)),
   load_mode  TEXT CHECK (load_mode  IS NULL OR load_mode  IN ('total','added','assisted'))
   ```

   `NULL` em `grip_type`/`grip_width` significa "não se aplica" (leg press, agachamento) — uma sentinela `'none'` seria pior. `load_mode` é `NULL` quando `uses_bodyweight = 0`, espelhando as regras já existentes de `pulley_type` e `bench_angle_degrees`. Essas invariantes cruzadas continuam aplicadas em TS dentro de `updateExerciseConfig`, não em CHECK, como já é feito hoje.

3. **`session_exercise_config` deixa de ser override esparso e vira snapshot completo** — mesmas colunas de `exercise_config`, mesmas obrigatoriedades, exatamente uma linha por `session_exercise` (nunca zero). `ExerciseConfigOverride` e a semântica de "herdar" desaparecem.

4. **Nova `session_exercise_muscle_groups`** `(session_exercise_id, muscle_group, counting_factor)` — snapshot dos grupos e fatores no momento em que o exercício entrou na sessão. É o que o analytics de séries passa a ler.

## Migração v18

Segue as convenções do arquivo: recuperação de rebuild interrompido, gate por `hasColumn`/`hasTable` (nunca por `schema_version`) e `PRAGMA foreign_key_check` **escopado** às tabelas tocadas.

1. `ALTER TABLE ADD COLUMN` para `is_archived` e para as 4 colunas novas. `ADD COLUMN` **aceita CHECK** no SQLite (a restrição real é só `UNIQUE`/`PRIMARY KEY` e `NOT NULL` sem default) — verificado no sqlite3 3.50.6. Nenhum rebuild necessário aqui.
2. **Rebuild de `session_exercise_config`** (nullable → `NOT NULL`). O `INSERT … SELECT` parte de `session_exercises` (não da tabela antiga) e materializa `COALESCE(sec.col, ec.col, <default>)` — exatamente o que o app exibe hoje, para que nada mude visualmente no upgrade.
3. **Backfill de `session_exercise_muscle_groups`** a partir de `exercise_muscle_groups`, idempotente, rodando a cada launch (padrão auto-curativo do backfill de v15).

## Camada de dados

**Ponto único de snapshot:** todo `session_exercise` nasce em `addSessionExercise`. Em transação: `INSERT OR IGNORE` na `session_exercises` → resolver o **id real** por `SELECT` (o `lastInsertRowId` fica obsoleto quando o `OR IGNORE` dispara) → `INSERT OR IGNORE` dos dois snapshots. O `OR IGNORE` garante que re-adicionar um exercício já presente não sobrescreve um snapshot editado. Mesmo tratamento nos dois `INSERT … session_exercises` de `importExportApply.ts`.

**Leitura:** `getSessionExercises` lê `sec.*` direto (com fallback defensivo para linha legada) e traz `muscle_groups` com `counting_factor` do snapshot.

**Analytics congelado:** `getMuscleSeriesInRange`, `getMuscleSeriesForSession` e o subquery de `muscle_groups_csv` em `getSetsInRange` passam por `sets → session_exercises → session_exercise_muscle_groups`. O `UNIQUE(session_id, exercise_id)` torna o join determinístico e a migração v9 já garantiu linha em `session_exercises` para todo set.

**Funções novas / alteradas:**

| Função | Comportamento |
|---|---|
| `updateExercise(id, {name, equipment, type, modality})` | Rename propaga de graça. `name` é `UNIQUE` → erro tipado em colisão. |
| `archiveExercise` / `unarchiveExercise` | Soft-delete; sem `DELETE`, pois `sets`/`session_exercises` referenciam `exercise_id` sem cascade. |
| `getExercises(filter)` | Filtra `is_archived = 0` por padrão; `include_archived` para a tela de gerenciamento. |
| `updateExerciseConfig(id, config, opts?)` | `opts.applyToHistory` reescreve os snapshots existentes. Padrão: só daqui pra frente. |
| `updateExerciseMuscleGroups(id, groups, opts?)` | Idem, sobre os grupos musculares. |
| `updateSessionExerciseConfig(seId, config)` | Recebe `ExerciseConfig` (valores concretos), não mais um override. |
| `resetSessionExerciseConfig(seId, exerciseId)` | Recopia o padrão atual sobre o snapshot — substitui o "Herdar". |

## UI

- **`ExerciseConfigEditor`** vira single-mode sobre `ExerciseConfig` (some o modo `"override"`, os chips "Herdar" e o prop `defaultConfig`), com seções novas de pegada (tipo e largura, com "Não se aplica" ⇒ `null`) e peso corporal (flag + `load_mode` condicional, como já é feito com `pulley_type` e a `BenchSection`).
- **Novo `MuscleGroupEditor`**, extraído do `ExercisePickerModal`, usado pelo picker e pela tela de edição.
- **`app/exercises/[id].tsx`** vira a superfície de edição completa: nome, equipamento, tipo, modalidade, grupos musculares, config e arquivar. Ao salvar, se config/grupos mudaram e o exercício tem histórico, confirmar "aplicar também às sessões já registradas?". O gate `isStrength` para a config física permanece — é intencional.
- **`SetLogger`** edita o snapshot direto, com botão "Restaurar padrão do exercício".

## Export / import — v6

`is_archived` no exercício; em cada sessão-exercício, `config_override?` é substituído por `config` (snapshot completo) + `muscle_groups`. Payloads v5 são rejeitados pela checagem já existente, sem caminho de conversão — coerente com o que o app já faz entre versões.

## Verificação

`npx tsc --noEmit`, `npx eslint .`, `npx jest`, migração sobre DB populado, e E2E manual em web e Android: rename propaga; editar config sem aplicar ao histórico não move sessão antiga; aplicar ao histórico move; mudar `counting_factor` não altera séries passadas; restaurar padrão dentro da sessão; arquivar some do picker; exportar/reimportar v6.
