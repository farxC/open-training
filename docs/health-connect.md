# Health Connect no Android

O primeiro incremento faz importação **manual** de corridas. Segundo plano e
notificações são trabalhos posteriores. A [importação FIT](import-fit.md) é uma
alternativa disponível no navegador, Android e iOS.

## Usar

1. Instalar um build Android atualizado do open-training; Expo Go não inclui
   o conector nativo. O Health Connect precisa estar disponível no celular
   (Android 9 ou superior).
2. Sincronizar o Bip 6 no Zepp e habilitar o compartilhamento com Health Connect.
   Conferir no Health Connect os exercícios e sua origem antes de importar.
3. No open-training, abrir **Configurações → Importar do Health Connect**.
4. Conceder leitura de exercícios. Distância, batimentos e passos/cadência são
   opcionais; não solicitamos escrita, histórico ampliado ou acesso em segundo plano.
5. Buscar corridas dos últimos 29 dias. A lista mostra origem e horário.
6. Selecionar a corrida e vinculá-la a uma sessão do mesmo dia ou criar uma nova.
   Sessões já vinculadas oferecem atualização das métricas.

O Zepp pode compartilhar apenas parte das métricas. Permissão concedida não
comprova que existem dados de cadência; isso precisa ser validado no aparelho.
O navegador e o iOS podem ler dados restaurados de backup, mas não consultam
o Health Connect do Android.

## Semântica e armazenamento

- A seleção da sessão é explícita. Não associamos atividades automaticamente
  por proximidade de data, distância ou horário.
- Apenas registros da origem da corrida são consultados. Exercícios sobrepostos,
  dispositivos concorrentes e amostras conflitantes exigem resolução na origem.
- Amostras são recortadas ao intervalo `[início, fim)`, com instantes UTC,
  IDs externos e procedência. Cadência mantém casas decimais e zeros reais.
- Médias são agregações do Health Connect para a origem e período selecionados,
  identificadas como tal. Máximas são calculadas das amostras disponíveis.
  Não afirmamos que as medições cobrem a corrida inteira.
- Gráficos não unem lacunas superiores a 60 segundos. Os dados persistidos
  mantêm todas as amostras importadas; a curva reduz pontos para renderização.
- Uma nova sessão copia a duração decorrida, que pode incluir pausas. Não
  calculamos pace em movimento sem conhecer o tempo ativo.
- Distância é copiada apenas quando os registros não se sobrepõem e cobrem
  integralmente o período. Caso contrário, fica ausente para preenchimento manual.
- Atualizar o vínculo substitui seu snapshot atomicamente; mantém trechos,
  duração, distância e anotações da sessão. Uma permissão revogada não apaga
  amostras já importadas daquela métrica.

O schema 21 adicionou `session_health_connect`: um snapshot JSON versionado por
sessão, com unicidade de `(source_scope, origin_app, external_id)` e UUID próprio.
Este incremento ainda não implementa os registros manuais normalizados de FC/
cadência nem o RPE da sessão previstos na proposta de modelagem.

O backup formato 9 inclui snapshots do Health Connect e FIT, e ainda aceita
arquivos nos formatos 7 e 8.
UUIDs preservam os relacionamentos, sem transportar IDs locais ou permissões.
O namespace local da integração não é reutilizado automaticamente após uma
restauração: a tela permite reconectar explicitamente uma sessão restaurada da
mesma origem. Excluir uma sessão elimina seu snapshot por cascade.

## Build e validação

Depois de instalar dependências, regenerar o Android antes de compilar:

```sh
npx expo prebuild --platform android --no-install
make android-debug
```

O APK de debug requer Metro para executar o JavaScript. O projeto também possui
`make android-release` para o build independente, com a assinatura local já
configurada. `make android-debug` sozinho não regenera um Android já existente.

As versões `react-native-health-connect@3.5.3`, `expo-health-connect@0.1.1` e
`expo-build-properties@0.13.3` estão fixadas para esta integração com Expo 52.
`expo-health-connect` fornece o delegado de permissões nativo; o plugin local
`plugins/withHealthConnect.js` configura descoberta e a tela de justificativa.
Uma migração para o conector v4 deve substituir o módulo legado, sem instalar
os dois simultaneamente.

No aparelho, validar: negar permissões opcionais; importar uma corrida real;
comparar métricas com Zepp/Health Connect; repetir sem duplicar; revogar acesso;
restaurar backup e conferir a tela de justificativa em Android 13 e 14+.

Referências: [leitura e paginação no Health Connect](https://developer.android.com/health-and-fitness/health-connect/read-data),
[conector React Native](https://github.com/matinzd/react-native-health-connect/tree/v3.5.3).
