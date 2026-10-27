// Prototype only: comments belong to a session, never to the treatment as a whole.
messages.forEach((message, index) => { message.sessionIndex = index; });
sessions.forEach(session => { session.professionals = ['doctor', 'ana']; });
const drafts = new Map();
const mayComment = index => ['admin', 'secretary'].includes(role()) ||
  (sessions[index].professionals ?? ['doctor', 'ana']).includes(role());
const mayEditComment = message => role() === 'admin' ||
  (mayComment(message.sessionIndex) && message.author === role());
const grid = document.querySelector('.grid');
const actions = document.querySelector('.panelactions');
grid.className = 'treatment-sections';
grid.innerHTML = `<div class="section-headings"><div><h3>Percurso do tratamento</h3><p class="muted">Consultas e cirurgias por ordem cronológica.</p></div><div><h3>Comentários por consulta</h3><p class="muted">Cada conversa acompanha a respetiva sessão.</p></div></div><div id="session-rows"></div>`;
grid.append(actions);

render = function () {
  const complete = sessions.filter(s => s.done).length;
  const planned = sessions.filter(s => !s.done && s.date).length;
  $('#progress-count').textContent = `${complete} de ${sessions.length}`;
  $('#progress-bar').style.width = `${complete / sessions.length * 100}%`;
  $('#progress-copy').textContent = `${complete} concluídas · ${planned} marcadas · ${sessions.length - complete - planned} por marcar`;
  $('#treatment-status').textContent = closed ? 'Concluído' : 'Em curso';
  $('#finish').textContent = closed ? 'Reabrir tratamento' : 'Concluir tratamento';
  $('#session-rows').innerHTML = sessions.map((session, index) => {
    const comments = messages.map((message, messageIndex) => ({ ...message, messageIndex }))
      .filter(message => message.sessionIndex === index);
    const date = session.date ? new Date(session.date + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }) + ' · ' + session.time : 'Data a definir';
    return `<section class="consultation-row" aria-label="${escape(session.name)}">
      <div class="consultation-detail"><div class="session ${session.done ? 'done' : session.date ? 'next' : ''}">
        <span class="mark">${session.done ? '✓' : index + 1}</span>
        <button class="sessioncard" data-session="${index}"><div class="row"><h3>${escape(session.name)}</h3><span class="badge ${session.done ? '' : 'gold'}">${session.done ? 'Concluída' : session.date ? 'Marcada' : 'Por marcar'}</span></div>
          <p>${date} · ${session.type} · 30 min</p>${doctors()}
          ${session.note ? `<div class="session-note"><strong>Observações internas</strong><p>${escape(session.note)}</p></div>` : ''}
          <small>Abrir detalhes da sessão ↗</small>
        </button></div></div>
      <div class="session-discussion"><div class="discussion-heading"><h4>Comentários <span>${comments.length}</span></h4><small>Internos · Esta consulta</small></div>
        <div class="session-messages" aria-live="polite">${comments.length ? comments.map(message => `<article class="message ${message.author === role() ? 'mine' : ''}"><header><strong>${escape(people[message.author])}</strong><small>${escape(message.date)}</small></header><div class="bubble">${escape(message.text)}</div><div class="row"><small>${message.history.length ? 'Editado · histórico preservado' : ''}</small><div>${mayEditComment(message) ? `<button data-edit="${message.messageIndex}">Editar</button>` : ''}${message.history.length ? `<button data-history="${message.messageIndex}">Histórico</button>` : ''}</div></div></article>`).join('') : '<p class="empty-comments">Ainda não há comentários nesta consulta.</p>'}</div>
        <form class="session-compose" data-compose="${index}"><label class="hidden" for="comment-${index}">Comentário sobre ${escape(session.name)}</label><textarea id="comment-${index}" placeholder="Comentar esta consulta…" required ${mayComment(index) ? '' : 'disabled'}>${escape(drafts.get(index) ?? '')}</textarea><div class="row"><small>${mayComment(index) ? 'Equipa da consulta e secretariado' : 'Apenas leitura · Não participa nesta consulta'}</small><button class="primary" type="submit" ${mayComment(index) ? '' : 'disabled'}>Enviar</button></div></form>
      </div></section>`;
  }).join('');
  document.querySelectorAll('[data-session]').forEach(button => { button.onclick = () => openSession(+button.dataset.session); });
  document.querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => {
    if (mayEditComment(messages[+button.dataset.edit])) editMessage(+button.dataset.edit);
  }; });
  document.querySelectorAll('[data-history]').forEach(button => { button.onclick = () => showHistory(messages[+button.dataset.history]); });
  document.querySelectorAll('[data-compose]').forEach(form => {
    const index = +form.dataset.compose;
    const input = form.querySelector('textarea');
    input.oninput = () => drafts.set(index, input.value);
    form.onsubmit = event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !mayComment(index)) return;
      messages.push({ sessionIndex: index, author: role(), text, date: now(), history: [] });
      drafts.delete(index);
      render();
      document.querySelector(`#comment-${index}`).focus({ preventScroll: true });
    };
  });
  ['add', 'schedule', 'finish'].forEach(id => { $('#' + id).disabled = !canWrite(); });
};
$('#role').onchange = () => { drafts.clear(); render(); };
render();
