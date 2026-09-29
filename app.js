'use strict';

// IndexedDB stores the board and image blobs locally, with no network requests.
(() => {
  const $ = id => document.getElementById(id);
  let sequence = 0;
  const id = () => `item-${++sequence}`;
  const colors = ['#bd9ce9', '#dfa7bf', '#9aaee1', '#9cc6bb', '#c89ddb', '#d9b89d'];
  const colorNames = ['Lavanda', 'Rosa empolvado', 'Azul pervinca', 'Verde salvia', 'Malva', 'Melocotón'];
  let columns = ['Pendiente', 'Hoy', 'Esta semana', 'Hecho'].map((name, i) => ({ id: id(), name, color: colors[i], cards: [] }));
  let editingCard = null, editingColumn = null, draftImage = null, imagePending = false, imageGeneration = 0, confirmAction = null, focusReturn = null, toastTimer;
  const urls = new Set();
  const imageFiles = new Map();
  let database = null, saveRevision = 0;
  const taskDialog = $('task-dialog');
  const board = $('board');
  const marker = document.createElement('div');
  marker.className = 'drop-marker';
  let drag = null, pointer = null, scrollFrame = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, action) {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function release(url) { if (url && urls.has(url)) { URL.revokeObjectURL(url); urls.delete(url); imageFiles.delete(url); } }
  function storageStatus(title, message, failed = false) {
    $('storage-title').textContent = title;
    $('storage-message').textContent = message;
    $('storage-status').classList.toggle('storage-error', failed);
  }
  function saveBoard() {
    if (!database) { storageStatus('Sin guardar', 'El almacenamiento no está disponible. No cierres la página.', true); return; }
    const revision = ++saveRevision;
    storageStatus('Guardando…', 'En el almacenamiento de este navegador.');
    try {
      const transaction = database.transaction('board', 'readwrite');
      const snapshot = { version: 1, sequence, columns: columns.map(c => ({ ...c, cards: c.cards.map(card => ({ ...card, image: card.image ? imageFiles.get(card.image) : null })) })) };
      transaction.objectStore('board').put(snapshot, 'current');
      transaction.oncomplete = () => { if (revision === saveRevision) storageStatus('Guardado en este navegador', 'Tus tareas e imágenes se conservan al volver.'); };
      transaction.onabort = transaction.onerror = () => { if (revision === saveRevision) storageStatus('Cambios sin guardar', 'No se pudo guardar. Revisa el espacio disponible antes de cerrar.', true); };
    } catch { storageStatus('Cambios sin guardar', 'No se pudo guardar. Revisa el espacio disponible antes de cerrar.', true); }
  }
  async function loadBoard() {
    document.querySelector('main').inert = true;
    try {
      database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('tablero-local', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('board');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => storageStatus('Esperando almacenamiento', 'Cierra otras pestañas de este tablero para continuar.', true);
      });
      database.onversionchange = () => { database.close(); database = null; storageStatus('Almacenamiento desconectado', 'Recarga la página para volver a guardar.', true); };
      const saved = await new Promise((resolve, reject) => {
        const request = database.transaction('board').objectStore('board').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (saved) {
        if (saved.version !== 1 || !Array.isArray(saved.columns)) throw new Error('Unsupported board');
        const identifiers = new Set();
        const validId = value => { if (typeof value !== 'string' || !/^item-\d+$/.test(value) || identifiers.has(value)) throw new Error('Invalid identifier'); identifiers.add(value); sequence = Math.max(sequence, Number(value.slice(5))); };
        columns = saved.columns.map(column => {
          validId(column.id);
          if (typeof column.name !== 'string' || !Array.isArray(column.cards)) throw new Error('Invalid column');
          return { id: column.id, name: column.name, color: colors.includes(column.color) ? column.color : colors[0], cards: column.cards.map(card => {
            validId(card.id);
            if (typeof card.title !== 'string' || typeof card.content !== 'string' || (card.image != null && !(card.image instanceof Blob))) throw new Error('Invalid card');
            let image = null;
            if (card.image) { image = URL.createObjectURL(card.image); urls.add(image); imageFiles.set(image, card.image); }
            return { id: card.id, title: card.title, content: card.content, image };
          }) };
        });
      }
      storageStatus('Guardado en este navegador', 'Tus tareas e imágenes se conservan al volver.');
    } catch {
      database?.close(); database = null;
      storageStatus('Almacenamiento no disponible', 'No se han sobrescrito tus datos. Los nuevos cambios no se guardarán.', true);
    } finally { render(false); document.querySelector('main').inert = false; }
  }
  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
    $('announcer').textContent = message;
  }
  function findCard(cardId) {
    for (const column of columns) { const card = column.cards.find(c => c.id === cardId); if (card) return { card, column }; }
    return null;
  }
  function render(persist = true) {
    board.replaceChildren();
    columns.forEach((column, index) => {
      const section = el('section', 'column');
      section.dataset.columnId = column.id;
      section.style.setProperty('--column-color', column.color);
      const header = el('div', 'column-header');
      const dot = el('span', 'column-dot'); dot.setAttribute('aria-hidden', 'true');
      const title = el('h2', '', column.name); title.id = `heading-${column.id}`; title.title = column.name;
      section.setAttribute('aria-labelledby', title.id);
      const count = el('span', 'count', column.cards.length); count.setAttribute('aria-label', `${column.cards.length} tareas`);
      const menu = el('details', 'column-menu');
      const summary = el('summary', '', '···'); summary.setAttribute('aria-label', `Opciones de ${column.name}`);
      const items = el('div', 'menu-items');
      items.append(button('', 'Renombrar columna', () => { menu.open = false; openColumn(column.id); }));
      items.append(button('', 'Cambiar color', () => { menu.open = false; openColumn(column.id); $('column-color').focus(); }));
      const left = button('', '← Mover a la izquierda', () => moveColumn(index, -1)); left.disabled = index === 0;
      const right = button('', 'Mover a la derecha →', () => moveColumn(index, 1)); right.disabled = index === columns.length - 1;
      items.append(left, right, button('', 'Eliminar columna', () => {
        menu.open = false;
        askDelete(`¿Eliminar «${column.name}»?`, column.cards.length ? `También se eliminarán sus ${column.cards.length} tareas e imágenes. Esta acción no se puede deshacer.` : 'Puedes volver a crear una columna cuando quieras.', () => {
          column.cards.forEach(c => release(c.image));
          columns = columns.filter(c => c.id !== column.id); render(); notify('Columna eliminada');
        });
      }));
      menu.append(summary, items); header.append(dot, title, count, menu);
      const list = el('div', 'card-list'); list.dataset.columnId = column.id;
      column.cards.forEach(card => {
        const node = button('card', '', () => { if (!drag && !pointer?.active) openTask(column.id, card.id); });
        node.draggable = true; node.dataset.cardId = card.id;
        node.setAttribute('aria-label', `Editar tarea: ${card.title}`);
        if (card.image) { const image = el('img', 'card-cover'); image.src = card.image; image.alt = ''; image.draggable = false; node.append(image); }
        const body = el('div', 'card-body'); body.append(el('span', 'card-title', card.title));
        if (card.content) body.append(el('p', 'card-excerpt', card.content));
        if (card.content || card.image) { const meta = el('div', 'card-meta'); if (card.content) meta.append(el('span', '', '≡ Descripción')); if (card.image) meta.append(el('span', '', '▧ Imagen')); body.append(meta); }
        node.append(body); list.append(node);
      });
      if (!column.cards.length) {
        const empty = el('div', 'empty-state');
        empty.append(el('span', 'empty-icon', index === 3 ? '✓' : '▤'), el('p', '', 'Todo empieza con una tarea'), el('span', '', 'Añade una o arrástrala aquí'));
        list.append(empty);
      }
      const add = button('add-task', '', () => openTask(column.id));
      add.append(el('span', '', '＋'), document.createTextNode('Añadir tarea'));
      section.append(header, list, add); board.append(section);
    });
    board.append(button('add-column', '＋  Añadir columna', () => openColumn()));
    const total = columns.reduce((sum, c) => sum + c.cards.length, 0);
    $('total-count').textContent = `${total} ${total === 1 ? 'tarea' : 'tareas'}`;
    if (persist) saveBoard();
  }
  function moveColumn(index, delta) {
    [columns[index], columns[index + delta]] = [columns[index + delta], columns[index]];
    render(); board.querySelectorAll('summary')[index + delta].focus(); notify('Columna reordenada');
  }
  function openColumn(columnId = null) {
    focusReturn = document.activeElement;
    editingColumn = columnId;
    $('column-heading').textContent = columnId ? 'Editar columna' : 'Nueva columna';
    $('column-name').value = columnId ? columns.find(c => c.id === columnId).name : '';
    $('column-name').setCustomValidity('');
    $('column-color').replaceChildren(...colors.map((color, i) => { const option = el('option', '', colorNames[i]); option.value = color; return option; }));
    $('column-color').value = columnId ? columns.find(c => c.id === columnId).color : colors[columns.length % colors.length];
    $('column-dialog').showModal(); $('column-name').focus();
  }
  function restoreFocus() { (focusReturn?.isConnected ? focusReturn : $('new-task')).focus(); }
  $('column-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('column-name').value.trim();
    if (!name) { $('column-name').setCustomValidity('Escribe un nombre para la columna.'); $('column-name').reportValidity(); return; }
    const color = $('column-color').value;
    if (editingColumn) Object.assign(columns.find(c => c.id === editingColumn), { name, color });
    else columns.push({ id: id(), name, color, cards: [] });
    $('column-dialog').close(); render(); restoreFocus(); notify(editingColumn ? 'Columna actualizada' : 'Columna creada');
    if (!editingColumn) board.scrollTo({ left: board.scrollWidth, behavior: 'smooth' });
  });
  $('column-name').addEventListener('input', () => $('column-name').setCustomValidity(''));
  ['close-column', 'cancel-column'].forEach(key => $(key).addEventListener('click', () => $('column-dialog').close()));
  $('column-dialog').addEventListener('close', restoreFocus);

  function updateImagePreview() {
    $('image-preview').hidden = !draftImage; $('upload-box').hidden = !!draftImage;
    if (draftImage) $('preview-image').src = draftImage; else $('preview-image').removeAttribute('src');
  }
  function openTask(columnId, cardId = null) {
    if (!columns.length) { openColumn(); notify('Crea primero una columna para tus tareas'); return; }
    focusReturn = document.activeElement;
    editingCard = cardId;
    const card = cardId ? findCard(cardId).card : null;
    $('task-form').reset(); $('task-title').setCustomValidity('');
    $('task-title').value = card?.title || ''; $('task-content').value = card?.content || '';
    $('task-column').replaceChildren(...columns.map(c => { const option = el('option', '', c.name); option.value = c.id; return option; }));
    $('task-column').value = columnId || columns[0].id;
    $('task-heading').textContent = card ? 'Editar tarea' : 'Nueva tarea';
    $('submit-task').textContent = card ? 'Aplicar cambios' : 'Crear tarea';
    $('submit-task').disabled = false;
    $('delete-task').hidden = !card;
    $('image-error').hidden = true;
    draftImage = card?.image || null; imagePending = false; updateImagePreview();
    taskDialog.showModal(); $('task-title').focus();
  }
  $('new-task').addEventListener('click', () => openTask(columns[0]?.id));
  document.querySelectorAll('.close-task').forEach(b => b.addEventListener('click', () => taskDialog.close()));
  taskDialog.addEventListener('close', () => {
    imageGeneration++;
    const original = editingCard ? findCard(editingCard)?.card.image : null;
    if (draftImage && draftImage !== original) release(draftImage);
    draftImage = null; imagePending = false; updateImagePreview(); $('task-form').reset(); restoreFocus();
  });
  $('task-title').addEventListener('input', () => $('task-title').setCustomValidity(''));
  $('task-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('task-title').value.trim();
    if (!title) { $('task-title').setCustomValidity('Escribe un título para la tarea.'); $('task-title').reportValidity(); return; }
    if (imagePending) return;
    const target = columns.find(c => c.id === $('task-column').value);
    const existing = editingCard ? findCard(editingCard) : null;
    const card = { id: editingCard || id(), title, content: $('task-content').value.trim(), image: draftImage };
    if (existing) {
      if (existing.card.image !== draftImage) release(existing.card.image);
      if (existing.column === target) target.cards.splice(target.cards.indexOf(existing.card), 1, card);
      else { existing.column.cards = existing.column.cards.filter(c => c.id !== editingCard); target.cards.push(card); }
    } else target.cards.push(card);
    // Transfer ownership to the card before closing the form.
    draftImage = null; taskDialog.close(); render(); restoreFocus();
    notify(existing ? 'Tarea actualizada' : 'Tarea creada. Un paso más cerca.');
  });
  $('task-image').addEventListener('change', async () => {
    const file = $('task-image').files[0]; if (!file) return;
    const generation = ++imageGeneration;
    $('image-error').hidden = true;
    const error = message => { $('image-error').textContent = message; $('image-error').hidden = false; $('task-image').value = ''; };
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { error('Elige una imagen JPG, PNG, WebP o GIF.'); return; }
    if (file.size > 10 * 1024 * 1024) { error('La imagen supera los 10 MB. Elige una más pequeña.'); return; }
    imagePending = true; $('submit-task').disabled = true;
    const url = URL.createObjectURL(file); urls.add(url); imageFiles.set(url, file);
    try {
      const test = new Image(); test.src = url; await test.decode();
      if (generation !== imageGeneration || !taskDialog.open) { release(url); return; }
      if (test.naturalWidth * test.naturalHeight > 40000000) throw new Error('dimensions');
      const original = editingCard ? findCard(editingCard)?.card.image : null;
      if (draftImage && draftImage !== original) release(draftImage);
      draftImage = url; updateImagePreview();
    } catch (e) {
      release(url);
      if (generation === imageGeneration) error(e.message === 'dimensions' ? 'La imagen es demasiado grande. Usa una de menos de 40 megapíxeles.' : 'No se ha podido abrir esta imagen. Prueba con otro archivo.');
    } finally { if (generation === imageGeneration) { imagePending = false; $('submit-task').disabled = false; } }
  });
  $('remove-image').addEventListener('click', () => {
    imageGeneration++;
    const original = editingCard ? findCard(editingCard)?.card.image : null;
    if (draftImage && draftImage !== original) release(draftImage);
    draftImage = null; $('task-image').value = ''; updateImagePreview(); $('task-image').focus();
  });
  function askDelete(title, description, action) {
    $('confirm-heading').textContent = title; $('confirm-description').textContent = description;
    confirmAction = action; $('confirm-dialog').showModal();
  }
  $('cancel-delete').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-delete').addEventListener('click', () => { const action = confirmAction; $('confirm-dialog').close(); action?.(); });
  $('confirm-dialog').addEventListener('close', () => { confirmAction = null; if (!taskDialog.open) $('new-task').focus(); });
  $('delete-task').addEventListener('click', () => {
    const existing = findCard(editingCard);
    askDelete('¿Eliminar esta tarea?', `Se eliminará «${existing.card.title}» y su imagen. Esta acción no se puede deshacer.`, () => {
      release(existing.card.image); existing.column.cards = existing.column.cards.filter(c => c.id !== editingCard);
      taskDialog.close(); render(); restoreFocus(); notify('Tarea eliminada');
    });
  });
  document.addEventListener('click', event => { document.querySelectorAll('.column-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.querySelectorAll('.column-menu[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); }); if (pointer?.active) finishPointer(false); } });

  // Desktop HTML drag-and-drop, plus touch/pen dragging with a long press.
  function startDrag(node) {
    drag = { id: node.dataset.cardId, node, target: null, before: null, x: 0, y: 0 };
    node.classList.add('dragging');
  }
  function locateDrop(x, y) {
    if (!drag) return;
    drag.x = x; drag.y = y;
    const hit = document.elementFromPoint(x, y);
    const section = hit?.closest('.column');
    board.querySelectorAll('.drop-active').forEach(n => n.classList.remove('drop-active'));
    if (!section) { marker.remove(); drag.target = null; return; }
    const list = section.querySelector('.card-list');
    section.classList.add('drop-active'); drag.target = section.dataset.columnId;
    const next = [...list.querySelectorAll('.card:not(.dragging)')].find(n => { const r = n.getBoundingClientRect(); return y < r.top + r.height / 2; });
    drag.before = next?.dataset.cardId || null;
    list.insertBefore(marker, next || null);
  }
  function scrollDrag() {
    if (!drag) return;
    const bounds = board.getBoundingClientRect();
    if (drag.x < bounds.left + 48) board.scrollLeft -= 12;
    if (drag.x > bounds.right - 48) board.scrollLeft += 12;
    const list = board.querySelector('.drop-active .card-list');
    if (list) { const r = list.getBoundingClientRect(); if (drag.y < r.top + 40) list.scrollTop -= 9; if (drag.y > r.bottom - 40) list.scrollTop += 9; }
    locateDrop(drag.x, drag.y);
    scrollFrame = requestAnimationFrame(scrollDrag);
  }
  function endDrag(commit) {
    if (!drag) return;
    const old = drag;
    cancelAnimationFrame(scrollFrame); marker.remove(); old.node.classList.remove('dragging');
    board.querySelectorAll('.drop-active').forEach(n => n.classList.remove('drop-active'));
    drag = null;
    if (commit && old.target) {
      const source = findCard(old.id); const target = columns.find(c => c.id === old.target);
      source.column.cards = source.column.cards.filter(c => c.id !== old.id);
      const before = target.cards.findIndex(c => c.id === old.before);
      target.cards.splice(before < 0 ? target.cards.length : before, 0, source.card);
      render(); board.querySelector(`[data-card-id="${old.id}"]`)?.focus({ preventScroll: true });
      notify(`Tarea movida a ${target.name}`);
    }
  }
  board.addEventListener('dragstart', event => {
    const node = event.target.closest('.card'); if (!node || pointer?.active) { event.preventDefault(); return; }
    startDrag(node); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', node.dataset.cardId);
    drag.x = event.clientX; drag.y = event.clientY; scrollFrame = requestAnimationFrame(scrollDrag);
  });
  board.addEventListener('dragover', event => { if (!drag) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; locateDrop(event.clientX, event.clientY); });
  board.addEventListener('drop', event => { if (!drag) return; event.preventDefault(); locateDrop(event.clientX, event.clientY); endDrag(true); });
  board.addEventListener('dragend', () => endDrag(false));
  board.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || event.button !== 0 || pointer) return;
    const node = event.target.closest('.card'); if (!node) return;
    pointer = { id: event.pointerId, node, x: event.clientX, y: event.clientY, active: false };
    pointer.timer = setTimeout(() => {
      if (!pointer) return;
      pointer.active = true; startDrag(node); document.body.classList.add('pointer-dragging');
      const ghost = node.cloneNode(true); ghost.classList.remove('dragging'); ghost.classList.add('drag-ghost'); ghost.removeAttribute('data-card-id'); ghost.setAttribute('aria-hidden', 'true'); ghost.tabIndex = -1;
      ghost.style.width = `${node.offsetWidth}px`; document.body.append(ghost); pointer.ghost = ghost;
      positionGhost(pointer.x, pointer.y); locateDrop(pointer.x, pointer.y); scrollFrame = requestAnimationFrame(scrollDrag);
    }, 300);
  });
  function positionGhost(x, y) { if (pointer?.ghost) { pointer.ghost.style.left = `${x - 100}px`; pointer.ghost.style.top = `${y - 30}px`; } }
  document.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.active) { if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) { clearTimeout(pointer.timer); pointer = null; } return; }
    event.preventDefault(); positionGhost(event.clientX, event.clientY); locateDrop(event.clientX, event.clientY);
  }, { passive: false });
  document.addEventListener('touchmove', event => { if (pointer?.active) event.preventDefault(); }, { passive: false });
  function finishPointer(commit) {
    if (!pointer) return;
    const active = pointer.active; clearTimeout(pointer.timer); pointer.ghost?.remove(); document.body.classList.remove('pointer-dragging');
    if (active) endDrag(commit);
    pointer = null;
    if (active) { const suppress = e => { e.preventDefault(); e.stopPropagation(); }; document.addEventListener('click', suppress, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', suppress, true), 400); }
  }
  document.addEventListener('pointerup', () => finishPointer(true));
  document.addEventListener('pointercancel', () => finishPointer(false));
  document.addEventListener('contextmenu', event => { if (pointer?.active) event.preventDefault(); });
  // Object URLs are temporary; persisted image blobs are restored on load.
  window.addEventListener('pagehide', () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  loadBoard();
})();
