# PROMPT — Otimização Mobile do Grid de Faltas
**Arquivo alvo:** `frontend/src/pages/Faltas.tsx`
**Branch:** `claude/bold-hamilton-a1Oj6`
**Objetivo:** Tornar o grid de lançamento de faltas usável em celular (tela < 640px)
**Restrição CRÍTICA:** Nenhuma mudança pode afetar o layout em desktop (tela ≥ 640px)

---

## Por que é necessário

A tela de Faltas exibe uma tabela com ~22 colunas de dias (uma por dia letivo) + coluna de nome + colunas de totais. No celular, as células medem **24×24px**, o que é pequeno demais para toque. O botão Salvar fica no final da página e some após o scroll horizontal.

O padrão usado no código para detecção mobile é:
```typescript
const isMobile = window.innerWidth < 640;
```
Esse valor é calculado **uma vez** na montagem do componente — suficiente para o caso de uso (o professor não redimensiona a janela enquanto lança faltas).

---

## Checklist de alterações (execute na ordem)

### ✅ 1 — Adicionar constante `isMobile` no topo do componente

**Localização:** linha 34 (logo após `const isDark = themeMode === 'dark';`)

**ANTES:**
```typescript
  const isDark = themeMode === 'dark';
  const ST_BG = isDark ? ST_BG_DARK : ST_BG_LIGHT;
```

**DEPOIS:**
```typescript
  const isDark = themeMode === 'dark';
  const isMobile = window.innerWidth < 640;
  const ST_BG = isDark ? ST_BG_DARK : ST_BG_LIGHT;
```

---

### ✅ 2 — Reduzir largura mínima da coluna de nome no cabeçalho

**Localização:** linha 487 — `<th>` do cabeçalho da coluna `# Aluno`

**ANTES:**
```typescript
                    fontSize: 12, fontWeight: 600, minWidth: 210,
```

**DEPOIS:**
```typescript
                    fontSize: 12, fontWeight: 600, minWidth: isMobile ? 150 : 210,
```

---

### ✅ 3 — Reduzir fontSize dos números de dia no cabeçalho

**Localização:** linha 493 — `<th>` dentro do `Array(numDias).fill(0).map`

**ANTES:**
```typescript
                    <th key={d} style={{ width: 24, textAlign: 'center', fontSize: 10, padding: '8px 1px', fontWeight: 600 }}>
```

**DEPOIS:**
```typescript
                    <th key={d} style={{ width: isMobile ? 38 : 24, textAlign: 'center', fontSize: isMobile ? 9 : 10, padding: '8px 1px', fontWeight: 600 }}>
```

---

### ✅ 4 — Aumentar células de dia para toque confortável

**Localização:** linhas 547–565 — `<td key={d}` dentro do `dias.map((status, d) => ...)`

**ANTES (bloco completo):**
```typescript
                          {dias.map((status, d) => (
                            <td key={d}
                              onClick={() => toggleDia(a.id, d)}
                              title={`Dia ${d + 1}: ${ST_LABEL[status]} — clique para alternar`}
                              style={{
                                width: 24, textAlign: 'center', cursor: 'pointer',
                                background: ST_BG[status],
                                color: ST_COR[status],
                                fontWeight: 700, fontSize: 11,
                                padding: '7px 0',
                                borderLeft: '1px solid var(--border-light)',
                                userSelect: 'none',
                                transition: 'opacity 0.1s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                              {status}
                            </td>
                          ))}
```

**DEPOIS (bloco completo — substitua integralmente):**
```typescript
                          {dias.map((status, d) => (
                            <td key={d}
                              onClick={() => toggleDia(a.id, d)}
                              title={`Dia ${d + 1}: ${ST_LABEL[status]} — clique para alternar`}
                              style={{
                                width: isMobile ? 38 : 24,
                                textAlign: 'center', cursor: 'pointer',
                                background: ST_BG[status],
                                color: ST_COR[status],
                                fontWeight: 700,
                                fontSize: isMobile ? 13 : 11,
                                padding: isMobile ? '12px 0' : '7px 0',
                                borderLeft: '1px solid var(--border-light)',
                                userSelect: 'none',
                                transition: 'opacity 0.1s',
                                touchAction: 'manipulation',
                              }}
                              onMouseEnter={!isMobile ? (e => (e.currentTarget.style.opacity = '0.75')) : undefined}
                              onMouseLeave={!isMobile ? (e => (e.currentTarget.style.opacity = '1')) : undefined}
                            >
                              {status}
                            </td>
                          ))}
```

**Explicação das mudanças:**
| Propriedade | Desktop (≥640px) | Mobile (<640px) | Motivo |
|---|---|---|---|
| `width` | 24px | 38px | Área de toque mínima recomendada: 44px (38+borda) |
| `fontSize` | 11px | 13px | Legibilidade |
| `padding` | `7px 0` | `12px 0` | Aumenta altura da célula para 38px+ |
| `touchAction: 'manipulation'` | presente | presente | Remove delay de 300ms do iOS/Android |
| `onMouseEnter/Leave` | ativo | `undefined` | Hover não existe em toque; evita bug de "célula fica opaca" |

---

### ✅ 5 — Botão Salvar fixo na parte inferior em mobile

**Localização:** linhas 601–612 — `<button ... onClick={salvar}>`

**ANTES (bloco completo):**
```typescript
          <button
            style={{
              ...btn('primary', { full: true }),
              padding: '14px', fontSize: 17,
              background: saved ? theme.success : theme.primary,
              transition: 'all 0.2s ease',
              borderRadius: theme.radiusMd,
            }}
            onClick={salvar} disabled={saving}
          >
            {saving ? <><Spinner size={20} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
          </button>
```

**DEPOIS (bloco completo — substitua integralmente):**
```typescript
          <button
            style={{
              ...btn('primary', { full: true }),
              padding: '14px', fontSize: 17,
              background: saved ? theme.success : theme.primary,
              transition: 'all 0.2s ease',
              borderRadius: isMobile ? 0 : theme.radiusMd,
              position: isMobile ? 'sticky' : 'static',
              bottom: isMobile ? 0 : 'auto',
              zIndex: isMobile ? 10 : 'auto',
              boxShadow: isMobile ? '0 -2px 10px rgba(0,0,0,0.2)' : 'none',
            }}
            onClick={salvar} disabled={saving}
          >
            {saving ? <><Spinner size={20} /> Salvando...</> : saved ? '✅ Salvo!' : '💾 Salvar Faltas'}
          </button>
```

**Explicação:**
- `position: 'sticky'` + `bottom: 0` faz o botão "grudar" na borda inferior da viewport enquanto o usuário scrollar horizontalmente — sem precisar de portal ou position fixed.
- `borderRadius: 0` em mobile porque o botão ocupa toda a largura e encosta nas bordas laterais, o que fica mais natural sem arredondamento.
- `boxShadow` sutil para dar profundidade visual indicando que é flutuante.
- Em **desktop nada muda** — `position: 'static'` é o padrão normal.

---

## Verificação após implementação

### No celular (ou DevTools com viewport < 640px):
1. Abrir a tela Faltas — o cabeçalho deve carregar
2. Selecionar uma turma — a grade de dias deve aparecer com células visivelmente maiores
3. Tocar em uma célula → deve alternar P→F→J→A com resposta imediata (sem delay)
4. Scrollar horizontalmente até o fim das colunas → o botão **💾 Salvar Faltas** deve aparecer fixo na parte inferior da tela
5. Tocar em Salvar → deve funcionar normalmente

### No desktop (viewport ≥ 640px):
1. Abrir a tela Faltas — layout deve ser **idêntico ao que era antes**
2. Células devem ter 24px de largura (não 38px)
3. Hover sobre célula → deve ficar opaca (0.75) e voltar ao normal ao sair
4. Botão Salvar deve estar no fluxo normal da página (não sticky)

---

## Notas técnicas importantes

- **NÃO use CSS media queries** — o código do projeto usa estilos inline com `style={{}}`. Misturar com classes CSS criaria inconsistência de manutenção.
- **NÃO use `useEffect` para detectar resize** — `isMobile` é calculado uma vez na montagem. Para este caso de uso (professor abre a tela no celular e lança faltas), não há necessidade de reatividade ao resize.
- **NÃO altere** as colunas de totais (P, F, J, A, Freq.) — elas têm `width: 30` e já são compactas o suficiente.
- **NÃO altere** `exportarFolhaOCR`, `exportarPDF`, `exportarDiario`, `exportarExcel` — essas funções geram HTML para impressão, não são afetadas pelo viewport.
- **A coluna de nomes já é sticky** (`position: 'sticky', left: 0`) — não precisa de nenhuma mudança, apenas reduzir o `minWidth`.

---

## Exemplo visual esperado (mobile ~390px de largura)

```
┌──────────────────────────┬────┬────┬────┬────┐
│ # Aluno (sticky)         │ 1  │ 2  │ 3  │... │
├──────────────────────────┼────┼────┼────┼────┤
│ 01 JOÃO DA SILVA         │ P  │ F  │ P  │... │  ← célula 38×38px
│ 02 MARIA OLIVEIRA        │ P  │ P  │ P  │... │
│ ...                      │    │    │    │    │
└──────────────────────────┴────┴────┴────┴────┘
[      💾 Salvar Faltas      ]  ← sticky no bottom
```

---

## Arquivo a modificar

**Um único arquivo:** `frontend/src/pages/Faltas.tsx`

**Linhas afetadas (referência — confirme no arquivo atual antes de editar):**
- Linha 34: adicionar `isMobile`
- Linha 487: `minWidth` da coluna nome no `<th>`
- Linha 493: `width` e `fontSize` dos `<th>` de dia
- Linhas 547–565: bloco `dias.map(...)` com as células de status
- Linhas 601–612: botão Salvar

**Nenhum outro arquivo precisa ser modificado.**
