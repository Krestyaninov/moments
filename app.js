document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabUrl = document.getElementById('tab-url');
  const tabFile = document.getElementById('tab-file');
  const tabPaste = document.getElementById('tab-paste');
  
  const sectionUrl = document.getElementById('section-url');
  const sectionFile = document.getElementById('section-file');
  const sectionPaste = document.getElementById('section-paste');
  
  const feedUrlInput = document.getElementById('feed-url');
  const fetchBtn = document.getElementById('fetch-btn');
  const fileInput = document.getElementById('file-input');
  const dragDropZone = document.getElementById('drag-drop-zone');
  const pasteArea = document.getElementById('paste-area');
  const parsePasteBtn = document.getElementById('parse-paste-btn');
  
  const searchInput = document.getElementById('search-input');
  const copyAllSkusBtn = document.getElementById('copy-all-skus');
  
  const tableBody = document.querySelector('#offers-table tbody');
  const statusContainer = document.getElementById('status-container');
  const dataCard = document.getElementById('data-card');
  const controlCard = document.getElementById('control-card');
  
  // New buttons
  const showOffersBtn = document.getElementById('show-offers-btn');
  const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
  
  // App State
  let allOffers = [];
  let categoryMap = {};
  
  // Tabs Switcher
  const tabs = [
    { btn: tabUrl, section: sectionUrl },
    { btn: tabFile, section: sectionFile },
    { btn: tabPaste, section: sectionPaste }
  ];
  
  tabs.forEach(tab => {
    tab.btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.remove('active');
        t.section.classList.add('hidden');
      });
      tab.btn.classList.add('active');
      tab.section.classList.remove('hidden');
    });
  });

  // Toggle settings panel
  toggleSettingsBtn.addEventListener('click', () => {
    controlCard.classList.toggle('hidden');
  });

  // Main action button triggers loading the URL feed
  showOffersBtn.addEventListener('click', () => {
    const url = feedUrlInput.value.trim();
    if (!url) {
      showToast('Введите URL фида в настройках', 'error');
      controlCard.classList.remove('hidden');
      return;
    }
    fetchFeed(url);
  });
  
  // Auto-load local moment.xml if served from a server
  if (window.location.protocol.startsWith('http')) {
    showLoading('Загрузка локального фида moment.xml...');
    fetch(`moment.xml?_t=${Date.now()}`, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error();
        return response.text();
      })
      .then(text => {
        parseXML(text);
        showToast('Локальный фид загружен автоматически!', 'success');
      })
      .catch(() => {
        // Fallback silently to show standard welcome message
        statusContainer.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <p>Нажмите на кнопку выше, чтобы загрузить товары для акции.</p>
        `;
      });
  }
  
  // Drag and Drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dragDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dragDropZone.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dragDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dragDropZone.classList.remove('dragover');
    }, false);
  });
  
  dragDropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      handleFile(files[0]);
    }
  });
  
  dragDropZone.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });
  
  // Action Handlers
  fetchBtn.addEventListener('click', () => {
    const url = feedUrlInput.value.trim();
    if (!url) {
      showToast('Введите URL фида', 'error');
      return;
    }
    fetchFeed(url);
  });
  
  parsePasteBtn.addEventListener('click', () => {
    const text = pasteArea.value.trim();
    if (!text) {
      showToast('Вставьте XML содержимое фида', 'error');
      return;
    }
    parseXML(text);
  });
  
  searchInput.addEventListener('input', () => {
    renderTable();
  });
  
  copyAllSkusBtn.addEventListener('click', () => {
    const filtered = getFilteredOffers().slice(0, 10);
    if (!filtered.length) {
      showToast('Нет товаров для копирования', 'warning');
      return;
    }
    const skus = filtered.map(o => o.sku).join('\n');
    navigator.clipboard.writeText(skus)
      .then(() => showToast('Артикулы топ-10 скопированы в буфер!', 'success'))
      .catch(() => showToast('Не удалось скопировать артикулы', 'error'));
  });

  // Fetch Feed with Fallbacks (Direct / Proxy)
  async function fetchFeed(url) {
    showLoading('Загрузка фида...');
    
    // Add cache buster to prevent browser and proxy caching
    const cacheBuster = `_t=${Date.now()}`;
    const cleanUrl = url + (url.includes('?') ? '&' : '?') + cacheBuster;
    
    // List of CORS proxies to try if direct fetch fails
    const proxies = [
      '', // Try direct fetch first
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url='
    ];
    
    let lastError = null;
    
    for (const proxy of proxies) {
      try {
        const fetchUrl = proxy ? `${proxy}${encodeURIComponent(cleanUrl)}` : cleanUrl;
        const response = await fetch(fetchUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const text = await response.text();
        
        // Success
        parseXML(text);
        showToast('Фид успешно загружен!', 'success');
        return;
      } catch (err) {
        lastError = err;
        console.warn(`Fetch failed with endpoint: ${proxy || 'Direct'}`, err);
      }
    }
    
    showError(`Не удалось загрузить фид. Возникла ошибка CORS или сети. Попробуйте скачать файл и загрузить его напрямую через вкладку "Загрузить файл".\n\nДетали: ${lastError.message}`);
  }
  
  // Handle File Input
  function handleFile(file) {
    const reader = new FileReader();
    showLoading('Чтение файла...');
    reader.onload = (e) => {
      parseXML(e.target.result);
      showToast(`Файл "${file.name}" загружен!`, 'success');
    };
    reader.onerror = () => {
      showError('Ошибка при чтении файла');
    };
    reader.readAsText(file);
  }
  
  // Parse XML Feed
  function parseXML(xmlText) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      
      // Check for parser errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error(parserError.textContent || 'Ошибка парсинга XML');
      }
      
      // Parse Categories
      categoryMap = {};
      const categories = xmlDoc.querySelectorAll('category');
      categories.forEach(cat => {
        const id = cat.getAttribute('id');
        const name = cat.textContent.trim();
        if (id && name) {
          categoryMap[id] = name;
        }
      });
      
      // Parse Offers
      const offersNodeList = xmlDoc.querySelectorAll('offer');
      allOffers = [];
      
      offersNodeList.forEach(offer => {
        const id = offer.getAttribute('id') || '';
        const vendorCodeNode = offer.querySelector('vendorCode');
        const vendorCode = vendorCodeNode ? vendorCodeNode.textContent.trim() : '';
        const sku = vendorCode || id; // Articul is vendorCode if exists, else ID
        
        const nameNode = offer.querySelector('name');
        const name = nameNode ? nameNode.textContent.trim() : 'Без названия';
        
        const priceNode = offer.querySelector('price');
        const price = priceNode ? parseFloat(priceNode.textContent) || 0 : 0;
        
        const oldPriceNode = offer.querySelector('oldprice');
        const oldprice = oldPriceNode ? parseFloat(oldPriceNode.textContent) || 0 : null;
        
        const categoryIdNode = offer.querySelector('categoryId');
        const categoryId = categoryIdNode ? categoryIdNode.textContent.trim() : '';
        const categoryName = categoryMap[categoryId] || 'Другое';
        
        // Find custom stock field (custom_label_0 or custom_lable_0)
        let stockNode = offer.querySelector('custom_label_0');
        if (!stockNode) {
          stockNode = offer.querySelector('custom_lable_0');
        }
        
        const stock = stockNode ? parseInt(stockNode.textContent, 10) || 0 : 0;
        
        allOffers.push({
          id,
          vendorCode,
          sku,
          name,
          price,
          oldprice,
          categoryName,
          stock
        });
      });
      
      if (allOffers.length === 0) {
        showError('В фиде не найдено товарных предложений (<offer>)');
        return;
      }
      
      // Show data and stats
      dataCard.classList.remove('hidden');
      statusContainer.classList.add('hidden');
      
      renderTable();
    } catch (err) {
      console.error(err);
      showError(`Ошибка чтения XML-фида: ${err.message}`);
    }
  }
  
  // Filter offers based on search query
  function getFilteredOffers() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      return allOffers.sort((a, b) => b.stock - a.stock);
    }
    return allOffers
      .filter(o => 
        o.name.toLowerCase().includes(query) || 
        o.sku.toLowerCase().includes(query) || 
        o.categoryName.toLowerCase().includes(query)
      )
      .sort((a, b) => b.stock - a.stock);
  }
  
  // Render Data Table
  window.copySku = function(sku) {
    navigator.clipboard.writeText(sku)
      .then(() => showToast(`Артикул ${sku} скопирован!`, 'success'))
      .catch(() => showToast('Не удалось скопировать', 'error'));
  };
  
  function renderTable() {
    tableBody.innerHTML = '';
    const sortedAndFiltered = getFilteredOffers();
    const top10 = sortedAndFiltered.slice(0, 10);
    
    if (top10.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Товары не найдены</td></tr>`;
      return;
    }
    
    top10.forEach((offer, index) => {
      const row = document.createElement('tr');
      
      let stockClass = 'stock-low';
      if (offer.stock > 10) {
        stockClass = 'stock-high';
      } else if (offer.stock > 3) {
        stockClass = 'stock-medium';
      }
      
      const priceFormatted = offer.price.toLocaleString('ru-RU') + ' ₽';
      const oldPriceFormatted = offer.oldprice ? offer.oldprice.toLocaleString('ru-RU') + ' ₽' : '';
      
      // Build code label
      const displaySku = offer.sku;
      const subLabel = offer.vendorCode && offer.vendorCode !== offer.id ? `ID: ${offer.id}` : '';
      
      row.innerHTML = `
        <td class="col-rank">#${index + 1}</td>
        <td class="col-sku">
          <div class="sku-copy-wrapper" onclick="copySku('${offer.sku}')" title="Нажмите, чтобы скопировать">
            <span>${displaySku}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </div>
          ${subLabel ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${subLabel}</div>` : ''}
        </td>
        <td>
          <div class="product-cell">
            <span class="product-name" title="${offer.name}">${offer.name}</span>
            <span class="product-category">${offer.categoryName}</span>
          </div>
        </td>
        <td>
          <div class="price-cell">
            <span class="price-current">${priceFormatted}</span>
            ${offer.oldprice ? `<span class="price-old">${oldPriceFormatted}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="stock-cell">
            <span class="stock-badge ${stockClass}">${offer.stock} шт.</span>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }
  
  // UI Helpers
  function showLoading(msg) {
    dataCard.classList.add('hidden');
    statusContainer.classList.remove('hidden');
    statusContainer.innerHTML = `
      <div class="spinner"></div>
      <p style="margin-top: 1rem;">${msg}</p>
    `;
  }
  
  function showError(msg) {
    dataCard.classList.add('hidden');
    statusContainer.classList.remove('hidden');
    statusContainer.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <p style="margin-top: 1rem; color: var(--error); max-width: 500px; white-space: pre-wrap; word-break: break-word;">${msg}</p>
    `;
  }
  
  // Toast notifications
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
  
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.role = 'alert';
    
    let icon = '';
    if (type === 'success') {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else if (type === 'warning') {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else {
      icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    }, duration);
  }
});
