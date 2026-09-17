(() => {
  const EDITOR_SELECTOR = '#censo-direto-editor';
  const PANEL_ID = 'censo-pendencias-detalhadas';
  const STYLE_ID = 'censo-pendencias-style';
  let timer = null;

  const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const norm = (v) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #censo-direto-editor .censo-pendente-alvo {
        outline: 2px solid var(--warning) !important;
        outline-offset: 2px;
        border-radius: 8px;
      }
      #censo-direto-editor .censo-pendente-nota {
        display: block;
        margin-top: 5px;
        color: var(--warning);
        font-size: 10.5px;
        font-weight: 800;
      }
      #censo-direto-editor .censo-conferir-alvo {
        outline: 1px dashed var(--text-muted) !important;
        outline-offset: 2px;
        border-radius: 8px;
      }
      #${PANEL_ID} {
        margin: 10px 0 12px;
        display: grid;
        gap: 9px;
      }
      #${PANEL_ID} .censo-pendencias-bloco {
        border: 1px solid color-mix(in srgb, var(--warning) 55%, transparent);
        background: color-mix(in srgb, var(--warning) 10%, transparent);
        border-radius: 9px;
        padding: 10px;
      }
      #${PANEL_ID} .censo-conferir-bloco {
        border: 1px solid var(--border);
        background: var(--ghost-bg);
        border-radius: 9px;
        padding: 10px;
      }
      #${PANEL_ID} .censo-pendencias-titulo {
        font-size: 11.5px;
        font-weight: 900;
        color: var(--warning);
        margin-bottom: 7px;
      }
      #${PANEL_ID} .censo-conferir-titulo {
        font-size: 11px;
        font-weight: 850;
        color: var(--text-secondary);
        margin-bottom: 7px;
      }
      #${PANEL_ID} .censo-pendencias-chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      #${PANEL_ID} button.censo-pendencia-chip {
        appearance: none;
        border: 1px solid color-mix(in srgb, var(--warning) 65%, transparent);
        background: color-mix(in srgb, var(--warning) 16%, var(--card));
        color: var(--text);
        border-radius: 999px;
        padding: 6px 9px;
        font: 800 10.5px/1.2 var(--font);
        cursor: pointer;
      }
      #${PANEL_ID} button.censo-conferir-chip {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text-secondary);
        border-radius: 999px;
        padding: 6px 9px;
        font: 700 10.5px/1.2 var(--font);
        cursor: pointer;
      }
      #${PANEL_ID} button:hover { transform: translateY(-1px); }
    `;
    document.head.appendChild(style);
  }

  function labels(editor) {
    return [...editor.querySelectorAll('label')];
  }

  function labelByText(editor, expected) {
    const n = norm(expected);
    return labels(editor).find((label) => {
      const span = label.querySelector(':scope > span');
      return norm(span?.textContent || '').startsWith(n);
    }) || null;
  }

  function controlByText(editor, expected) {
    const label = labelByText(editor, expected);
    if (!label) return null;
    return label.querySelector('input,select,textarea');
  }

  function valueOf(editor, expected) {
    const c = controlByText(editor, expected);
    return c ? txt(c.value) : '';
  }

  function headingByText(editor, expected) {
    const n = norm(expected);
    return [...editor.querySelectorAll('h3,div')].find((el) => norm(el.textContent || '').startsWith(n)) || null;
  }

  function addPending(pendings, key, label, target, note = 'Preenchimento pendente') {
    if (!target) return;
    pendings.push({ key, label, target, note });
  }

  function groupSelectionPending(editor, headingText, label, pendings, key) {
    const heading = headingByText(editor, headingText);
    const group = heading?.nextElementSibling;
    if (!heading || !group) return;
    const checks = [...group.querySelectorAll('input[type="checkbox"]')];
    if (checks.length && !checks.some((c) => c.checked)) {
      addPending(pendings, key, label, group, 'Selecione pelo menos uma opção');
    }
  }

  function courseCards(editor) {
    const typeLabels = labels(editor).filter((label) => norm(label.querySelector(':scope > span')?.textContent || '').startsWith('1º TIPO'));
    return typeLabels.map((label) => {
      let node = label.parentElement;
      while (node && node !== editor) {
        if (norm(node.textContent || '').includes('REMOVER CURSO')) return node;
        node = node.parentElement;
      }
      return label.parentElement;
    }).filter(Boolean);
  }

  function postCards(editor) {
    const typeLabels = labels(editor).filter((label) => norm(label.querySelector(':scope > span')?.textContent || '') === 'TIPO *');
    return typeLabels.map((label) => {
      let node = label.parentElement;
      while (node && node !== editor) {
        if (norm(node.textContent || '').includes('REMOVER POS')) return node;
        node = node.parentElement;
      }
      return label.parentElement;
    }).filter(Boolean);
  }

  function controlInCard(card, prefix) {
    const n = norm(prefix);
    const label = [...card.querySelectorAll('label')].find((el) => norm(el.querySelector(':scope > span')?.textContent || '').startsWith(n));
    return label?.querySelector('input,select,textarea') || null;
  }

  function optionalField(optional, editor, expected, label) {
    const c = controlByText(editor, expected);
    if (c && !txt(c.value)) optional.push({ key: `opt-${expected}`, label, target: c.closest('label') || c });
  }

  function clearMarks(editor) {
    editor.querySelectorAll('.censo-pendente-alvo').forEach((el) => el.classList.remove('censo-pendente-alvo'));
    editor.querySelectorAll('.censo-conferir-alvo').forEach((el) => el.classList.remove('censo-conferir-alvo'));
    editor.querySelectorAll('.censo-pendente-nota[data-censo-generated="1"]').forEach((el) => el.remove());
  }

  function markPending(item) {
    const target = item.target;
    const label = target.matches?.('label') ? target : (target.closest?.('label') || target);
    label.classList.add('censo-pendente-alvo');
    if (!label.querySelector(':scope > .censo-pendente-nota[data-censo-generated="1"]')) {
      const note = document.createElement('span');
      note.className = 'censo-pendente-nota';
      note.dataset.censoGenerated = '1';
      note.textContent = `⚠ ${item.note}`;
      label.appendChild(note);
    }
  }

  function goTo(item) {
    const target = item.target;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const control = target.matches?.('input,select,textarea') ? target : target.querySelector?.('input,select,textarea');
      control?.focus?.({ preventScroll: true });
    }, 350);
  }

  function renderPanel(editor, pendings, optional) {
    const submit = [...editor.querySelectorAll('button')].find((b) => norm(b.textContent || '').includes('SALVAR E ENVIAR AO FORMULARIO OFICIAL'));
    const footer = submit?.parentElement?.parentElement;
    if (!footer) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      const declaration = [...footer.querySelectorAll('label')].find((l) => norm(l.textContent || '').includes('DECLARO QUE AS INFORMACOES'));
      footer.insertBefore(panel, declaration || submit?.parentElement || null);
    }
    panel.innerHTML = '';

    if (pendings.length) {
      const block = document.createElement('div');
      block.className = 'censo-pendencias-bloco';
      const title = document.createElement('div');
      title.className = 'censo-pendencias-titulo';
      title.textContent = `⚠ Pendências de preenchimento (${pendings.length}) — clique para ir ao campo`;
      const chips = document.createElement('div');
      chips.className = 'censo-pendencias-chips';
      pendings.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'censo-pendencia-chip';
        btn.textContent = `→ ${item.label}`;
        btn.addEventListener('click', () => goTo(item));
        chips.appendChild(btn);
      });
      block.append(title, chips);
      panel.appendChild(block);
    }

    if (optional.length) {
      const block = document.createElement('div');
      block.className = 'censo-conferir-bloco';
      const title = document.createElement('div');
      title.className = 'censo-conferir-titulo';
      title.textContent = 'Campos sem informação — conferir antes do envio (não bloqueiam automaticamente)';
      const chips = document.createElement('div');
      chips.className = 'censo-pendencias-chips';
      optional.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'censo-conferir-chip';
        btn.textContent = item.label;
        btn.addEventListener('click', () => goTo(item));
        chips.appendChild(btn);
        const mark = item.target.matches?.('label') ? item.target : (item.target.closest?.('label') || item.target);
        mark.classList.add('censo-conferir-alvo');
      });
      block.append(title, chips);
      panel.appendChild(block);
    }

    if (submit) {
      submit.title = pendings.length
        ? 'Há campos para conferir, mas eles não bloqueiam o envio.'
        : '';
    }
  }

  function update() {
    const editor = document.querySelector(EDITOR_SELECTOR);
    if (!editor) {
      document.getElementById(PANEL_ID)?.remove();
      return;
    }
    ensureStyle();
    clearMarks(editor);

    const pendings = [];
    const optional = [];

    const requiredSimple = [
      ['Unidade Escolar de Preenchimento', 'Unidade Escolar'],
      ['Modalidade', 'Modalidade'],
      ['CPF', 'CPF'],
      ['Data Nasc.', 'Data de nascimento'],
      ['E-mail', 'E-mail'],
      ['Maior Grau de Formação', 'Maior Grau de Formação'],
      ['Situação da Pós-Graduação', 'Situação da Pós-Graduação'],
    ];

    requiredSimple.forEach(([field, label]) => {
      const c = controlByText(editor, field);
      if (c && !txt(c.value)) addPending(pendings, `req-${field}`, label, c.closest('label') || c);
    });

    groupSelectionPending(editor, '3. Deficiência / TEA / Altas Habilidades', 'Deficiência / TEA / Altas Habilidades', pendings, 'deficiencias');
    const cursosHeading = headingByText(editor, 'Outros cursos específicos');
    const cursosGroup = cursosHeading?.nextElementSibling;
    if (cursosHeading && cursosGroup) {
      const checks = [...cursosGroup.querySelectorAll('input[type="checkbox"]')];
      if (checks.length && !checks.some((c) => c.checked)) addPending(pendings, 'cursos80h', 'Cursos específicos de 80h', cursosGroup, 'Selecione uma opção ou marque “Nenhum”');
    }

    if (valueOf(editor, 'Maior Grau de Formação') === 'Ensino Superior') {
      const cards = courseCards(editor);
      const completos = cards.filter((card) => {
        const tipo = txt(controlInCard(card, '1º Tipo')?.value);
        const area = txt(controlInCard(card, '2º Área')?.value);
        const curso = txt(controlInCard(card, '3º Curso')?.value);
        return tipo && area && curso;
      });
      if (!completos.length) {
        const target = cards[0] || headingByText(editor, 'Curso(s) Superior(es)');
        addPending(pendings, 'curso-superior', 'Curso Superior — Tipo, Área e Curso', target, 'Ensino Superior exige pelo menos um curso completo');
      }
    }

    if (valueOf(editor, 'Situação da Pós-Graduação') === 'Possui pós-graduação concluída') {
      postCards(editor).forEach((card, i) => {
        const tipo = txt(controlInCard(card, 'Tipo')?.value);
        const area = txt(controlInCard(card, 'Área')?.value);
        const ano = txt(controlInCard(card, 'Ano Conclusão')?.value);
        if (!tipo) addPending(pendings, `pos-tipo-${i}`, `Tipo da ${i + 1}ª Pós`, controlInCard(card, 'Tipo')?.closest('label') || card);
        if (!area) addPending(pendings, `pos-area-${i}`, `Área da ${i + 1}ª Pós`, controlInCard(card, 'Área')?.closest('label') || card);
        if (!/^\d{4}$/.test(ano)) addPending(pendings, `pos-ano-${i}`, `Ano da ${i + 1}ª Pós`, controlInCard(card, 'Ano Conclusão')?.closest('label') || card, 'Informe o ano com 4 dígitos');
      });
    }

    const declaration = [...editor.querySelectorAll('label')].find((l) => norm(l.textContent || '').includes('DECLARO QUE AS INFORMACOES'));
    const declarationCheck = declaration?.querySelector('input[type="checkbox"]');
    if (declarationCheck && !declarationCheck.checked) addPending(pendings, 'declaracao', 'Declaração de conferência', declaration, 'Marque a declaração para liberar o envio');

    [
      ['Sexo', 'Sexo'],
      ['Cor/Raça', 'Cor/Raça'],
      ['Telefone/Celular', 'Telefone/Celular'],
      ['Filiação 1', 'Filiação 1'],
      ['Naturalidade (Cidade)', 'Naturalidade'],
      ['UF Nascimento', 'UF de nascimento'],
      ['CEP', 'CEP'],
      ['Rua/Avenida', 'Rua/Avenida'],
      ['Nº/Complemento', 'Nº/Complemento'],
      ['Bairro', 'Bairro'],
      ['Município', 'Município'],
      ['UF', 'UF residencial'],
    ].forEach(([field, label]) => optionalField(optional, editor, field, label));

    pendings.forEach(markPending);
    renderPanel(editor, pendings, optional);
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(update, 60);
  }

  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#censo-direto-editor')) schedule();
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches?.(EDITOR_SELECTOR) || n.querySelector?.(EDITOR_SELECTOR))))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
})();
