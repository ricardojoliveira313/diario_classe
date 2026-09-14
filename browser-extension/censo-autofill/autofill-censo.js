(() => {
  const normalize = (value) => String(value ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  const fire = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setInput = (el, value) => {
    if (!el || value == null || value === '') return false;

    if (el.tagName === 'SELECT') {
      const target = normalize(value);
      const option = [...el.options].find(o => normalize(o.textContent) === target)
        || [...el.options].find(o => normalize(o.textContent).includes(target))
        || [...el.options].find(o => target.includes(normalize(o.textContent)));
      if (!option) return false;
      el.value = option.value;
      fire(el);
      return true;
    }

    let finalValue = String(value);
    if (el.type === 'date') {
      const m = finalValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) finalValue = `${m[3]}-${m[2]}-${m[1]}`;
    }

    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) descriptor.set.call(el, finalValue);
    else el.value = finalValue;
    fire(el);
    return true;
  };

  const textOf = (el) => normalize(el?.textContent || '');

  const clickByText = (texts) => {
    const targets = texts.map(normalize);
    const els = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')];
    const el = els.find(x => visible(x) && targets.some(t => textOf(x) === t || textOf(x).includes(t) || normalize(x.value).includes(t)));
    if (!el) return false;
    el.click();
    return true;
  };

  const findField = (labelText) => {
    const target = normalize(labelText);

    for (const label of [...document.querySelectorAll('label')]) {
      const t = textOf(label);
      if (!t.includes(target)) continue;
      if (label.htmlFor) {
        const byId = document.getElementById(label.htmlFor);
        if (byId && visible(byId)) return byId;
      }
      const inside = label.querySelector('input, select, textarea');
      if (inside && visible(inside)) return inside;
      const parentField = label.parentElement?.querySelector('input, select, textarea');
      if (parentField && visible(parentField)) return parentField;
    }

    const candidates = [...document.querySelectorAll('div, p, span, strong, td, th')];
    const marker = candidates.find(el => {
      const t = textOf(el);
      return t === target || (t.startsWith(target) && t.length <= target.length + 18);
    });

    if (marker) {
      let node = marker;
      for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
        const field = node.querySelector?.('input, select, textarea');
        if (field && visible(field)) return field;
      }
    }

    return null;
  };

  const ufSigla = (value) => {
    const n = normalize(value);
    const map = {
      'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPA': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA',
      'CEARA': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', 'GOIAS': 'GO',
      'MARANHAO': 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG',
      'PARA': 'PA', 'PARAIBA': 'PB', 'PARANA': 'PR', 'PERNAMBUCO': 'PE', 'PIAUI': 'PI',
      'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS',
      'RONDONIA': 'RO', 'RORAIMA': 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP',
      'SERGIPE': 'SE', 'TOCANTINS': 'TO'
    };
    if (/^[A-Z]{2}$/.test(n)) return n;
    return map[n] || value;
  };

  const splitEndereco = (value) => {
    const s = String(value || '').trim();
    const m = s.match(/^(.*?)[,\s]+(\d+\w?(?:\s*[-/]\s*\w+)?(?:.*)?)$/i);
    return m ? { rua: m[1].trim(), numero: m[2].trim() } : { rua: s, numero: '' };
  };

  const statusBox = (() => {
    let box = document.getElementById('__censo_autofill_status');
    if (!box) {
      box = document.createElement('div');
      box.id = '__censo_autofill_status';
      Object.assign(box.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
        maxWidth: '360px', background: '#0f172a', color: '#e2e8f0',
        border: '1px solid #60a5fa', borderRadius: '10px', padding: '10px 12px',
        font: '13px/1.4 system-ui, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,.35)'
      });
      document.documentElement.appendChild(box);
    }
    return box;
  })();

  const setStatus = (message, ok = true) => {
    statusBox.style.borderColor = ok ? '#22c55e' : '#f59e0b';
    statusBox.textContent = message;
  };

  const fillForm = (payload) => {
    const endereco = splitEndereco(payload.endereco);

    const mapping = [
      ['Unidade Escolar de Preenchimento', payload.unidade],
      ['Modalidade', payload.modalidade],
      ['Nome Completo', payload.nome],
      ['CPF', payload.cpf],
      ['Data Nasc.', payload.nascimento],
      ['Telefone/Celular', payload.telefone],
      ['E-mail', payload.email],
      ['Filiação 1', payload.filiacao1],
      ['Filiação 2', payload.filiacao2],
      ['Naturalidade (Cidade)', payload.naturalidade],
      ['CEP', payload.cep],
      ['Rua/Avenida', endereco.rua],
      ['Nº/Complemento', endereco.numero],
      ['Bairro', payload.bairro],
      ['Município', payload.municipio],
      ['UF', ufSigla(payload.uf)],
    ];

    let preenchidos = 0;
    for (const [label, value] of mapping) {
      if (!value) continue;
      const field = findField(label);
      if (!field) continue;
      if (field.tagName !== 'SELECT' && String(field.value || '').trim()) continue;
      if (setInput(field, value)) preenchidos++;
    }

    setStatus(`Censo: ${preenchidos} campos preenchidos. Confira os dados sensíveis, formação/pós e a declaração final. O envio NÃO é automático.`);
  };

  const run = (payload) => {
    if (!payload?.rf) return;

    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      const page = normalize(document.body?.innerText || '');

      if (page.includes('DIGITE SEU RF PARA INICIAR')) {
        const input = [...document.querySelectorAll('input')].find(visible);
        if (input && !String(input.value || '').trim()) {
          setInput(input, payload.rf);
          setStatus(`RF ${payload.rf} preenchido. Acessando cadastro...`);
          clickByText(['ACESSAR FORMULÁRIO']);
        }
        return;
      }

      if (page.includes('CONFIRMAR DADOS')) {
        const nomeOk = !payload.nome || page.includes(normalize(payload.nome));
        const rfOk = page.includes(normalize(payload.rf));
        if (nomeOk && rfOk) {
          setStatus('RF e nome conferem. Confirmando identidade para abrir o formulário...');
          clickByText(['SIM, SOU EU!', 'SIM, SOU EU']);
        } else {
          setStatus('Censo: a confirmação exibida não bateu com nome/RF esperado. Nada foi confirmado automaticamente.', false);
          clearInterval(timer);
        }
        return;
      }

      if (page.includes('1. DADOS DA INSTITUIÇÃO') || page.includes('DADOS DA INSTITUICAO')) {
        fillForm(payload);
        clearInterval(timer);
        return;
      }

      if (ticks > 60) {
        setStatus('Censo: não foi possível identificar a etapa do formulário. Use o RF copiado como fallback.', false);
        clearInterval(timer);
      }
    }, 500);
  };

  chrome.storage.local.get(['censoAutofillPayload', 'censoAutofillPreparedAt'], ({ censoAutofillPayload, censoAutofillPreparedAt }) => {
    if (!censoAutofillPayload) return;
    if (censoAutofillPreparedAt && Date.now() - censoAutofillPreparedAt > 10 * 60 * 1000) return;
    run(censoAutofillPayload);
  });
})();
