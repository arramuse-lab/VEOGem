(() => {
  'use strict';

  const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const MAX_REFERENCE_IMAGES = 6;
  const STORAGE_KEYS = {
    apiKey: 'veo_studio_api_key',
    baseUrl: 'veo_studio_base_url',
    pollInterval: 'veo_studio_poll_interval',
    liveBgMode: 'veo_studio_live_bg',
  };

  const MODEL_PRICING = {
    'gemini-omni-1.2-flash': {
      badge: 'Paling Hemat',
      badgeClass: 'badge-cheap',
      billingLabel: '$12.00 / 1M output token',
      perSec: { '360p': 0.023, '720p': 0.07, '1080p': 0.104, '4k': 0.209 },
      tokensPerSec: { '360p': 1917, '720p': 5792, '1080p': 8667, '4k': 17417 },
      minDuration: 3,
      maxDuration: 15,
      tip: 'Input teks/gambar: $1.50/1M token • Thought: $9/1M token. Tip: pakai 360p + 5 dtk (~$0.12) untuk tes prompt.',
    },
    'gemini-omni-1.1-flash': {
      badge: 'Standar Omni',
      badgeClass: 'badge-mid',
      billingLabel: '$17.50 / 1M output token',
      perSec: { '360p': 0.034, '720p': 0.10, '1080p': 0.15, '4k': 0.30 },
      tokensPerSec: { '360p': 1917, '720p': 5792, '1080p': 8667, '4k': 17417 },
      minDuration: 3,
      maxDuration: 15,
      tip: 'Lebih mahal ~45% dibanding gemini-omni-1.2-flash. Disarankan pakai gemini-omni-1.2-flash untuk hemat token.',
    },
    'veo-3.1-fast-generate-001': {
      badge: 'Veo Fast',
      badgeClass: 'badge-mid',
      billingLabel: 'Billing per detik (Vertex AI / Cloud)',
      perSec: { '360p': 0.10, '720p': 0.10, '1080p': 0.12, '4k': 0.30 },
      tokensPerSec: null,
      minDuration: 5,
      maxDuration: 8,
      tip: 'Model Veo 3.1 GA dihitung per detik (maks 8 dtk, min 720p) dan membutuhkan endpoint Google Cloud / Vertex AI.',
    },
    'veo-3.1-generate-001': {
      badge: 'Premium / Mahal',
      badgeClass: 'badge-high',
      billingLabel: 'Billing per detik (Vertex AI / Cloud)',
      perSec: { '360p': 0.40, '720p': 0.40, '1080p': 0.40, '4k': 0.60 },
      tokensPerSec: null,
      minDuration: 5,
      maxDuration: 8,
      tip: 'Kualitas tertinggi Veo 3.1 GA (~5× lebih mahal dari Omni 1.2 Flash). Membutuhkan endpoint Google Cloud / Vertex AI.',
    },
  };

  // App state
  const state = {
    apiKey: sessionStorage.getItem(STORAGE_KEYS.apiKey) || '',
    baseUrl: sessionStorage.getItem(STORAGE_KEYS.baseUrl) || DEFAULT_BASE_URL,
    pollIntervalSec: Number(sessionStorage.getItem(STORAGE_KEYS.pollInterval)) || 8,
    liveBgMode: localStorage.getItem(STORAGE_KEYS.liveBgMode) || 'aurora',
    proxyAvailable: false,
    demoMode: false,
    aspectRatio: '16:9',
    referenceImages: [], // Array of { id, name, size, mimeType, base64, dataUrl }
    imageRole: 'reference', // 'reference' | 'first_frame' | 'first_last'
    isGenerating: false,
    abortController: null,
    timerHandle: null,
    currentVideo: null, // { url, filename, prompt, model, aspectRatio, resolution, duration }
    history: [],
  };

  // DOM Elements
  const el = {
    liveBgCanvas: document.getElementById('liveBgCanvas'),
    liveBgBtn: document.getElementById('liveBgBtn'),
    liveBgLabel: document.getElementById('liveBgLabel'),
    connectionBadge: document.getElementById('connectionBadge'),
    connectionText: document.getElementById('connectionText'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    demoModeBtn: document.getElementById('demoModeBtn'),

    inlineKeyBanner: document.getElementById('inlineKeyBanner'),
    quickApiKey: document.getElementById('quickApiKey'),
    saveQuickKeyBtn: document.getElementById('saveQuickKeyBtn'),

    generateForm: document.getElementById('generateForm'),
    promptInput: document.getElementById('promptInput'),
    charCount: document.getElementById('charCount'),
    negativePromptInput: document.getElementById('negativePromptInput'),

    dropzone: document.getElementById('dropzone'),
    imageInput: document.getElementById('imageInput'),
    dropzoneEmpty: document.getElementById('dropzoneEmpty'),
    dropzoneGallery: document.getElementById('dropzoneGallery'),
    imageGrid: document.getElementById('imageGrid'),
    addMoreImagesBtn: document.getElementById('addMoreImagesBtn'),
    imageCountBadge: document.getElementById('imageCountBadge'),
    imageRoleRow: document.getElementById('imageRoleRow'),
    imageRoleSelect: document.getElementById('imageRoleSelect'),
    clearImageBtn: document.getElementById('clearImageBtn'),

    apiModeSelect: document.getElementById('apiModeSelect'),
    modelSelect: document.getElementById('modelSelect'),
    customModelField: document.getElementById('customModelField'),
    customModelInput: document.getElementById('customModelInput'),
    aspectGroup: document.getElementById('aspectGroup'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    durationSelect: document.getElementById('durationSelect'),

    pricingCard: document.getElementById('pricingCard'),
    pricingBadge: document.getElementById('pricingBadge'),
    pricingTotal: document.getElementById('pricingTotal'),
    pricingPerSec: document.getElementById('pricingPerSec'),
    pricingBilling: document.getElementById('pricingBilling'),
    pricingTip: document.getElementById('pricingTip'),

    generateBtn: document.getElementById('generateBtn'),
    generateBtnLabel: document.getElementById('generateBtnLabel'),
    cancelBtn: document.getElementById('cancelBtn'),

    emptyStage: document.getElementById('emptyStage'),
    loadingStage: document.getElementById('loadingStage'),
    playerStage: document.getElementById('playerStage'),
    errorStage: document.getElementById('errorStage'),

    loadingTitle: document.getElementById('loadingTitle'),
    loadingSubtitle: document.getElementById('loadingSubtitle'),
    progressBar: document.getElementById('progressBar'),
    elapsedTimer: document.getElementById('elapsedTimer'),
    pollCount: document.getElementById('pollCount'),
    opStatus: document.getElementById('opStatus'),
    operationIdBox: document.getElementById('operationIdBox'),

    resultVideo: document.getElementById('resultVideo'),
    resultPrompt: document.getElementById('resultPrompt'),
    resultTags: document.getElementById('resultTags'),
    downloadBtn: document.getElementById('downloadBtn'),

    errorMessage: document.getElementById('errorMessage'),
    errorHint: document.getElementById('errorHint'),
    dismissErrorBtn: document.getElementById('dismissErrorBtn'),

    historyCount: document.getElementById('historyCount'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    settingsModal: document.getElementById('settingsModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    clearKeyBtn: document.getElementById('clearKeyBtn'),
    modalApiKey: document.getElementById('modalApiKey'),
    toggleKeyVisBtn: document.getElementById('toggleKeyVisBtn'),
    baseUrlInput: document.getElementById('baseUrlInput'),
    pollIntervalInput: document.getElementById('pollIntervalInput'),
  };

  // --- Initialization ---
  async function init() {
    initLiveBackground();
    bindEvents();
    updatePricingInfo();
    await detectLocalProxy();
    syncConnectionUI();
  }

  async function detectLocalProxy() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
      return;
    }
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.proxy === true && data.hasApiKey) {
          state.proxyAvailable = true;
        }
      }
    } catch {
      // Not served by local Node proxy — direct browser mode
    }
  }

  function syncConnectionUI() {
    el.connectionBadge.className = 'status-pill';
    if (state.demoMode) {
      el.connectionBadge.classList.add('status-demo');
      el.connectionText.textContent = 'Mode Demo Aktif';
      el.inlineKeyBanner.classList.add('hidden');
      el.demoModeBtn.textContent = '✕ Keluar Mode Demo';
    } else if (state.proxyAvailable) {
      el.connectionBadge.classList.add('status-ready');
      el.connectionText.textContent = 'Terhubung via Server Proxy';
      el.inlineKeyBanner.classList.add('hidden');
      el.demoModeBtn.textContent = '✨ Coba Mode Demo';
    } else if (state.apiKey) {
      el.connectionBadge.classList.add('status-ready');
      el.connectionText.textContent = 'API Key Siap';
      el.inlineKeyBanner.classList.add('hidden');
      el.demoModeBtn.textContent = '✨ Coba Mode Demo';
    } else {
      el.connectionBadge.classList.add('status-idle');
      el.connectionText.textContent = 'Belum ada API Key';
      el.inlineKeyBanner.classList.remove('hidden');
      el.demoModeBtn.textContent = '✨ Coba Mode Demo';
    }
  }

  // --- Event Binding ---
  function bindEvents() {
    // Prompt character counter
    el.promptInput.addEventListener('input', () => {
      el.charCount.textContent = `${el.promptInput.value.length} karakter`;
    });

    // Prompt presets
    document.querySelectorAll('.chip[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.promptInput.value = btn.dataset.preset;
        el.charCount.textContent = `${el.promptInput.value.length} karakter`;
        el.promptInput.focus();
      });
    });

    // Quick inline API key save
    el.saveQuickKeyBtn.addEventListener('click', () => {
      const val = el.quickApiKey.value.trim();
      if (!val) {
        el.quickApiKey.focus();
        return;
      }
      state.apiKey = val;
      state.demoMode = false;
      sessionStorage.setItem(STORAGE_KEYS.apiKey, val);
      el.quickApiKey.value = '';
      syncConnectionUI();
    });

    // Demo mode toggle
    el.demoModeBtn.addEventListener('click', () => {
      state.demoMode = !state.demoMode;
      syncConnectionUI();
      if (state.demoMode && !el.promptInput.value.trim()) {
        el.promptInput.value =
          'Cinematic aerial drone shot flying over emerald green rice terraces in Ubud Bali during golden sunrise, soft morning mist rising, warm cinematic lighting';
        el.charCount.textContent = `${el.promptInput.value.length} karakter`;
      }
    });

    // Sync mode <-> model selection nicely
    el.modelSelect.addEventListener('change', () => {
      const val = el.modelSelect.value;
      el.customModelField.classList.toggle('hidden', val !== 'custom');
      if (val.startsWith('gemini-omni')) {
        el.apiModeSelect.value = 'interactions';
      } else if (val.startsWith('veo-')) {
        el.apiModeSelect.value = 'veo';
      }
      updatePricingInfo();
    });

    el.apiModeSelect.addEventListener('change', () => {
      const mode = el.apiModeSelect.value;
      if (mode === 'interactions' && el.modelSelect.value.startsWith('veo-')) {
        el.modelSelect.value = 'gemini-omni-1.2-flash';
        el.customModelField.classList.add('hidden');
      } else if (mode === 'veo' && el.modelSelect.value.startsWith('gemini-omni')) {
        el.modelSelect.value = 'veo-3.1-fast-generate-001';
        el.customModelField.classList.add('hidden');
      }
      updatePricingInfo();
    });

    el.customModelInput.addEventListener('input', updatePricingInfo);
    el.resolutionSelect.addEventListener('change', updatePricingInfo);
    el.durationSelect.addEventListener('change', updatePricingInfo);

    // Aspect ratio pills
    el.aspectGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.aspectGroup.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.aspectRatio = btn.dataset.value;
      });
    });

    // Multi-image upload / drag & drop
    el.dropzone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (state.referenceImages.length >= MAX_REFERENCE_IMAGES) return;
      el.imageInput.click();
    });
    el.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (state.referenceImages.length < MAX_REFERENCE_IMAGES) {
          el.imageInput.click();
        }
      }
    });
    el.addMoreImagesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.referenceImages.length < MAX_REFERENCE_IMAGES) {
        el.imageInput.click();
      }
    });
    el.imageInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) handleImageFiles(files);
      el.imageInput.value = '';
    });
    el.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropzone.classList.add('dragover');
    });
    el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragover'));
    el.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.dropzone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) handleImageFiles(files);
    });
    el.imageRoleSelect.addEventListener('change', () => {
      state.imageRole = el.imageRoleSelect.value;
      renderImageGallery();
    });
    el.clearImageBtn.addEventListener('click', clearAllReferenceImages);

    // Settings modal
    el.openSettingsBtn.addEventListener('click', openSettingsModal);
    el.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    el.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    el.modalBackdrop.addEventListener('click', closeSettingsModal);
    el.toggleKeyVisBtn.addEventListener('click', () => {
      const isPwd = el.modalApiKey.type === 'password';
      el.modalApiKey.type = isPwd ? 'text' : 'password';
      el.toggleKeyVisBtn.textContent = isPwd ? 'Sembunyi' : 'Lihat';
    });
    el.saveSettingsBtn.addEventListener('click', saveSettings);
    el.clearKeyBtn.addEventListener('click', () => {
      state.apiKey = '';
      sessionStorage.removeItem(STORAGE_KEYS.apiKey);
      el.modalApiKey.value = '';
      syncConnectionUI();
    });

    // Generate & Cancel
    el.generateForm.addEventListener('submit', onSubmitGenerate);
    el.cancelBtn.addEventListener('click', cancelGeneration);
    el.dismissErrorBtn.addEventListener('click', () => el.errorStage.classList.add('hidden'));

    // Download & History
    el.downloadBtn.addEventListener('click', downloadCurrentVideo);
    el.clearHistoryBtn.addEventListener('click', clearHistory);
  }

  // --- Multi-Image Handling ---
  function readFileAsImageEntry(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          base64,
          dataUrl,
        });
      };
      reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageFiles(files) {
    const remainingSlots = MAX_REFERENCE_IMAGES - state.referenceImages.length;
    if (remainingSlots <= 0) {
      showError(`Maksimal ${MAX_REFERENCE_IMAGES} foto referensi per generasi.`);
      return;
    }

    const errors = [];
    const validFiles = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: format bukan gambar (gunakan PNG/JPG/WebP)`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: ukuran melebihi 10 MB`);
        continue;
      }
      validFiles.push(file);
    }

    const filesToAdd = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      errors.push(`Hanya ${remainingSlots} foto tambahan yang dimuat (batas maksimal ${MAX_REFERENCE_IMAGES} foto).`);
    }

    const prevCount = state.referenceImages.length;
    for (const file of filesToAdd) {
      try {
        const entry = await readFileAsImageEntry(file);
        state.referenceImages.push(entry);
      } catch (err) {
        errors.push(err.message);
      }
    }

    // Smart default role selection
    const newCount = state.referenceImages.length;
    if (prevCount === 0 && newCount === 1) {
      state.imageRole = 'first_frame';
    } else if (newCount >= 2 && state.imageRole === 'first_frame') {
      state.imageRole = 'reference';
    }
    el.imageRoleSelect.value = state.imageRole;

    renderImageGallery();

    if (errors.length > 0) {
      showError(errors.join('\n'));
    }
  }

  function removeReferenceImage(id) {
    state.referenceImages = state.referenceImages.filter((img) => img.id !== id);
    if (state.referenceImages.length === 1 && state.imageRole === 'first_last') {
      state.imageRole = 'first_frame';
      el.imageRoleSelect.value = state.imageRole;
    }
    renderImageGallery();
  }

  function clearAllReferenceImages() {
    state.referenceImages = [];
    el.imageInput.value = '';
    renderImageGallery();
  }

  function getImageBadgeLabel(index) {
    if (state.imageRole === 'first_frame') {
      return index === 0 ? 'First' : `Ref #${index + 1}`;
    }
    if (state.imageRole === 'first_last') {
      if (index === 0) return 'First';
      if (index === 1) return 'Last';
      return `Ref #${index + 1}`;
    }
    return `Foto #${index + 1}`;
  }

  function renderImageGallery() {
    const count = state.referenceImages.length;
    const hasImages = count > 0;

    el.dropzoneEmpty.classList.toggle('hidden', hasImages);
    el.dropzoneGallery.classList.toggle('hidden', !hasImages);
    el.clearImageBtn.classList.toggle('hidden', !hasImages);
    el.imageCountBadge.classList.toggle('hidden', !hasImages);
    el.imageRoleRow.classList.toggle('hidden', !hasImages);

    el.imageCountBadge.textContent = `${count}/${MAX_REFERENCE_IMAGES} foto`;
    el.addMoreImagesBtn.disabled = count >= MAX_REFERENCE_IMAGES;
    el.addMoreImagesBtn.textContent =
      count >= MAX_REFERENCE_IMAGES ? 'Maksimal 6 Foto' : '+ Tambah Foto';

    el.imageGrid.innerHTML = '';
    state.referenceImages.forEach((img, index) => {
      const card = document.createElement('div');
      card.className = 'image-thumb-card';
      card.title = `${img.name} (${(img.size / 1024).toFixed(1)} KB)`;

      const imgEl = document.createElement('img');
      imgEl.src = img.dataUrl;
      imgEl.alt = img.name;

      const badge = document.createElement('span');
      badge.className = 'image-thumb-badge';
      badge.textContent = getImageBadgeLabel(index);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'image-thumb-remove';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', `Hapus ${img.name}`);
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeReferenceImage(img.id);
      });

      const caption = document.createElement('span');
      caption.className = 'image-thumb-caption';
      caption.textContent = img.name;

      card.appendChild(imgEl);
      card.appendChild(badge);
      card.appendChild(removeBtn);
      card.appendChild(caption);
      el.imageGrid.appendChild(card);
    });
  }

  // --- Settings Modal ---
  function openSettingsModal() {
    el.modalApiKey.value = state.apiKey;
    el.modalApiKey.type = 'password';
    el.toggleKeyVisBtn.textContent = 'Lihat';
    el.baseUrlInput.value = state.baseUrl;
    el.pollIntervalInput.value = String(state.pollIntervalSec);
    el.settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    el.settingsModal.classList.add('hidden');
  }

  function saveSettings() {
    const key = el.modalApiKey.value.trim();
    const baseUrl = (el.baseUrlInput.value.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const poll = Math.min(30, Math.max(3, Number(el.pollIntervalInput.value) || 8));

    state.apiKey = key;
    state.baseUrl = baseUrl;
    state.pollIntervalSec = poll;
    if (key) state.demoMode = false;

    if (key) sessionStorage.setItem(STORAGE_KEYS.apiKey, key);
    else sessionStorage.removeItem(STORAGE_KEYS.apiKey);
    sessionStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
    sessionStorage.setItem(STORAGE_KEYS.pollInterval, String(poll));

    syncConnectionUI();
    closeSettingsModal();
  }

  // --- Pricing Summary Updater ---
  function updatePricingInfo() {
    const model = getSelectedModel();
    const res = el.resolutionSelect.value;
    const rawDur = Number(el.durationSelect.value) || 8;
    const info = MODEL_PRICING[model];

    if (!info) {
      el.pricingBadge.className = 'pricing-badge badge-mid';
      el.pricingBadge.textContent = 'Custom Model';
      el.pricingTotal.textContent = 'Sesuai tarif API';
      el.pricingPerSec.textContent = `Model: ${model || '(belum diisi)'}`;
      el.pricingBilling.textContent = `Mode: ${el.apiModeSelect.value === 'interactions' ? '/interactions' : ':predictLongRunning'}`;
      el.pricingTip.textContent = 'Tarif bergantung pada penyedia endpoint & model kustom yang Anda masukkan.';
      return;
    }

    const effectiveRes = el.apiModeSelect.value === 'veo' && res === '360p' ? '720p' : res;
    const effectiveDur = Math.min(info.maxDuration, Math.max(info.minDuration, rawDur));
    const ratePerSec = info.perSec[effectiveRes] ?? info.perSec['720p'];
    const totalUsd = ratePerSec * effectiveDur;

    el.pricingBadge.className = `pricing-badge ${info.badgeClass}`;
    el.pricingBadge.textContent = info.badge;
    el.pricingTotal.textContent = `~$${totalUsd.toFixed(2)} (${effectiveDur} dtk)`;

    const perSecFormatted = ratePerSec < 0.05 ? ratePerSec.toFixed(3) : ratePerSec.toFixed(2);
    el.pricingPerSec.textContent = `~$${perSecFormatted}/dtk (${effectiveRes})`;

    if (info.tokensPerSec) {
      const estTokens = (info.tokensPerSec[effectiveRes] || 5792) * effectiveDur;
      el.pricingBilling.textContent = `${info.billingLabel} (~${estTokens.toLocaleString('id-ID')} tok)`;
    } else {
      el.pricingBilling.textContent = info.billingLabel;
    }

    el.pricingTip.textContent = info.tip;
  }

  // --- Video Generation Orchestrator ---
  function getSelectedModel() {
    if (el.modelSelect.value === 'custom') {
      return el.customModelInput.value.trim();
    }
    return el.modelSelect.value;
  }

  async function onSubmitGenerate(e) {
    e.preventDefault();
    if (state.isGenerating) return;

    const prompt = el.promptInput.value.trim();
    if (!prompt) {
      showError('Silakan masukkan deskripsi video (prompt) terlebih dahulu.');
      return;
    }

    const model = getSelectedModel();
    if (!model) {
      showError('Silakan isi Custom Model ID terlebih dahulu.');
      return;
    }

    if (!state.demoMode && !state.proxyAvailable && !state.apiKey) {
      showError(
        'API Key belum diisi.',
        'Masukkan Gemini API Key dari Google AI Studio, atau klik tombol "✨ Coba Mode Demo" untuk menguji tampilan tanpa API Key.'
      );
      el.quickApiKey.focus();
      return;
    }

    const params = {
      prompt,
      negativePrompt: el.negativePromptInput.value.trim(),
      mode: el.apiModeSelect.value,
      model,
      aspectRatio: state.aspectRatio,
      resolution: el.resolutionSelect.value,
      durationSeconds: Number(el.durationSelect.value) || 8,
      referenceImages: [...state.referenceImages],
      imageRole: state.imageRole,
    };

    if (params.imageRole === 'first_last' && params.referenceImages.length < 2) {
      showError('Mode Transisi First → Last Frame memerlukan minimal 2 foto.');
      return;
    }

    startLoadingUI();

    try {
      let videoResult;
      if (state.demoMode) {
        videoResult = await runDemoGeneration(params, state.abortController.signal);
      } else if (params.mode === 'interactions') {
        videoResult = await runInteractionsGeneration(params, state.abortController.signal);
      } else {
        videoResult = await runVeoGeneration(params, state.abortController.signal);
      }

      displayResultVideo(videoResult);
      addToHistory(videoResult);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        resetStageToIdle();
      } else {
        const message = err instanceof Error ? err.message : String(err);
        showError(message, getHelpfulHint(message, params));
        resetStageToIdle(true);
      }
    } finally {
      stopLoadingUI();
    }
  }

  function cancelGeneration() {
    if (state.abortController) {
      state.abortController.abort();
    }
  }

  // --- 1. Google Veo (:predictLongRunning) ---
  async function runVeoGeneration(params, signal) {
    updateLoadingState('Mengirim job ke Google Veo...', `Model: ${params.model}`, 12, 'MENGIRIM');

    const instance = { prompt: params.prompt };
    const imgs = params.referenceImages || [];
    if (imgs.length > 0) {
      if (params.imageRole === 'first_frame') {
        instance.image = {
          bytesBase64Encoded: imgs[0].base64,
          mimeType: imgs[0].mimeType,
        };
      } else if (params.imageRole === 'first_last' && imgs.length >= 2) {
        instance.image = {
          bytesBase64Encoded: imgs[0].base64,
          mimeType: imgs[0].mimeType,
        };
        instance.lastFrame = {
          bytesBase64Encoded: imgs[1].base64,
          mimeType: imgs[1].mimeType,
        };
      } else {
        // Multi-photo reference images (Veo 3.1 supports up to 3 asset references)
        instance.referenceImages = imgs.slice(0, 3).map((img) => ({
          image: {
            bytesBase64Encoded: img.base64,
            mimeType: img.mimeType,
          },
          referenceType: 'asset',
        }));
      }
    }

    const veoResolution = params.resolution === '360p' ? '720p' : params.resolution;
    const reqParameters = {
      sampleCount: 1,
      aspectRatio: params.aspectRatio,
      resolution: veoResolution,
      durationSeconds: Math.min(8, Math.max(5, params.durationSeconds)),
    };
    if (params.negativePrompt) {
      reqParameters.negativePrompt = params.negativePrompt;
    }

    const endpoint = state.proxyAvailable
      ? `/api/veo/generate`
      : `${state.baseUrl}/models/${encodeURIComponent(params.model)}:predictLongRunning`;

    const bodyPayload = state.proxyAvailable
      ? { model: params.model, instances: [instance], parameters: reqParameters }
      : { instances: [instance], parameters: reqParameters };

    const initRes = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(bodyPayload),
      signal,
    });

    const initJson = await parseJsonOrThrow(initRes);
    const operationName = initJson.name;
    if (!operationName) {
      throw new Error(`Respons tidak mengandung operation name:\n${JSON.stringify(initJson, null, 2)}`);
    }

    el.operationIdBox.textContent = operationName;
    el.operationIdBox.classList.remove('hidden');

    // Poll long-running operation
    let poll = 0;
    let opData = initJson;
    while (!opData.done) {
      poll += 1;
      el.pollCount.textContent = String(poll);
      const estimatedPct = Math.min(90, 18 + poll * 9);
      updateLoadingState(
        'Sedang merender video di server Google...',
        `Mengecek status tiap ${state.pollIntervalSec} detik`,
        estimatedPct,
        'RENDERING'
      );

      await sleep(state.pollIntervalSec * 1000, signal);

      const pollUrl = state.proxyAvailable
        ? `/api/veo/status?name=${encodeURIComponent(operationName)}`
        : `${state.baseUrl}/${operationName}`;

      const pollRes = await fetch(pollUrl, {
        method: 'GET',
        headers: buildHeaders(false),
        signal,
      });
      opData = await parseJsonOrThrow(pollRes);

      if (opData.error) {
        throw new Error(opData.error.message || JSON.stringify(opData.error, null, 2));
      }
    }

    updateLoadingState('Video selesai! Mengunduh hasil...', 'Menyiapkan video player', 95, 'UNDUH');
    const blobUrl = await extractVeoVideoBlob(opData, signal);

    return {
      url: blobUrl,
      ext: 'mp4',
      filename: `veo-${Date.now()}.mp4`,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      duration: `${reqParameters.durationSeconds}s`,
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  async function extractVeoVideoBlob(opData, signal) {
    const resp = opData.response || {};

    // Standard Gemini API Veo response paths
    const sampleUri =
      resp.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
      resp.generatedVideos?.[0]?.video?.uri ||
      resp.videos?.[0]?.gcsUri ||
      null;

    if (sampleUri) {
      return await downloadMediaAsBlob(sampleUri, signal);
    }

    // Inline base64 video fallback (Vertex AI style)
    const b64 =
      resp.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded ||
      resp.videos?.[0]?.bytesBase64Encoded ||
      resp.predictions?.[0]?.bytesBase64Encoded ||
      null;

    if (b64) {
      return base64ToBlobUrl(b64, 'video/mp4');
    }

    // Check safety/RAI filtering reason
    const filteredReasons = resp.generateVideoResponse?.raiMediaFilteredReasons;
    if (Array.isArray(filteredReasons) && filteredReasons.length > 0) {
      throw new Error(`Video diblokir oleh filter keamanan Google: ${filteredReasons.join('; ')}`);
    }

    throw new Error(`Operasi selesai, tetapi URL/data video tidak ditemukan di respons:\n${JSON.stringify(opData, null, 2)}`);
  }

  // --- 2. Gemini Omni Interactions API (/v1beta/interactions) ---
  async function runInteractionsGeneration(params, signal) {
    updateLoadingState('Mengirim job ke Gemini Interactions API...', `Model: ${params.model}`, 12, 'MENGIRIM');

    let promptText = params.prompt;
    if (params.negativePrompt) {
      const sep = /[.!?]$/.test(promptText) ? '' : '.';
      promptText = `${promptText}${sep} Avoid: ${params.negativePrompt}`;
    }

    const inputParts = [];
    const imgs = params.referenceImages || [];
    for (const img of imgs) {
      inputParts.push({
        type: 'image',
        data: img.base64,
        mime_type: img.mimeType,
      });
    }

    if (imgs.length > 0) {
      const sep = /[.!?]$/.test(promptText) ? '' : '.';
      if (params.imageRole === 'first_last' && imgs.length >= 2) {
        if (!/starting frame|first frame/i.test(promptText)) {
          promptText = `${promptText}${sep} Use the first image as the starting frame and the second image as the final frame.`;
        }
      } else if (params.imageRole === 'first_frame') {
        if (!/starting frame|first frame/i.test(promptText)) {
          const refLabel = imgs.length > 1 ? 'the first image' : 'this image';
          promptText = `${promptText}${sep} Use ${refLabel} as the starting frame.`;
        }
      } else if (!/reference/i.test(promptText)) {
        const hint =
          imgs.length > 1
            ? 'Use the provided images as visual references for character, objects, and style rather than literal starting frames.'
            : 'Use this image as a visual reference for style and subject.';
        promptText = `${promptText}${sep} ${hint}`;
      }
    }
    inputParts.push({ type: 'text', text: promptText });

    const maxAllowedDur = params.imageRole === 'first_last' && imgs.length >= 2 ? 10 : 15;
    const clampedDuration = Math.min(maxAllowedDur, Math.max(3, params.durationSeconds));
    const payload = {
      model: params.model,
      input: inputParts,
      background: true,
      store: true,
      response_format: {
        type: 'video',
        delivery: 'uri',
        aspect_ratio: params.aspectRatio,
        duration: `${clampedDuration}s`,
        resolution: params.resolution,
      },
    };

    const endpoint = state.proxyAvailable
      ? `/api/interactions/generate`
      : `${state.baseUrl}/interactions`;

    const initRes = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      signal,
    });

    let interaction = await parseJsonOrThrow(initRes);
    const interactionId = interaction.id;

    if (interactionId) {
      el.operationIdBox.textContent = `interaction/${interactionId}`;
      el.operationIdBox.classList.remove('hidden');
    }

    let poll = 0;
    while (
      interaction.status &&
      interaction.status !== 'completed' &&
      interaction.status !== 'failed' &&
      interaction.status !== 'cancelled'
    ) {
      poll += 1;
      el.pollCount.textContent = String(poll);
      const pct = Math.min(90, 18 + poll * 9);
      updateLoadingState(
        'Sedang merender video dengan Gemini Omni...',
        `Status: ${interaction.status} • Polling tiap ${state.pollIntervalSec} detik`,
        pct,
        String(interaction.status).toUpperCase()
      );

      await sleep(state.pollIntervalSec * 1000, signal);

      const pollUrl = state.proxyAvailable
        ? `/api/interactions/status?id=${encodeURIComponent(interactionId)}`
        : `${state.baseUrl}/interactions/${encodeURIComponent(interactionId)}`;

      const pollRes = await fetch(pollUrl, {
        method: 'GET',
        headers: buildHeaders(false),
        signal,
      });
      interaction = await parseJsonOrThrow(pollRes);
    }

    if (interaction.status === 'failed') {
      throw new Error(interaction.error?.message || JSON.stringify(interaction.error || interaction, null, 2));
    }

    updateLoadingState('Video selesai! Mengunduh hasil...', 'Menyiapkan video player', 95, 'UNDUH');
    const blobUrl = await extractInteractionVideoBlob(interaction, signal);

    const usageTokens = interaction.usage?.total_tokens || null;
    return {
      url: blobUrl,
      ext: 'mp4',
      filename: `gemini-video-${Date.now()}.mp4`,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      duration: `${clampedDuration}s`,
      interactionId: interactionId || null,
      totalTokens: usageTokens,
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  async function extractInteractionVideoBlob(interaction, signal) {
    // 1. Official Interactions REST API format: steps[].content[] (type: "model_output")
    const steps = Array.isArray(interaction.steps) ? interaction.steps : [];
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const step = steps[i];
      if (!step) continue;
      const contentList = Array.isArray(step.content)
        ? step.content
        : Array.isArray(step.parts)
          ? step.parts
          : [];
      for (const item of contentList) {
        const mime = item.mime_type || item.mimeType || '';
        const isVideo = item.type === 'video' || mime.startsWith('video/');
        if (!isVideo) continue;

        const uri = item.uri || item.url || item.file_uri || item.fileUri;
        if (uri) return await downloadMediaAsBlob(uri, signal);
        if (item.data) return base64ToBlobUrl(item.data, mime || 'video/mp4');
      }
    }

    // 2. SDK shorthand field: output_video
    const directVideo = interaction.output_video || interaction.outputVideo;
    if (directVideo) {
      const directUri = directVideo.uri || directVideo.url || directVideo.file_uri;
      if (directUri) return await downloadMediaAsBlob(directUri, signal);
      if (directVideo.data) {
        return base64ToBlobUrl(directVideo.data, directVideo.mime_type || directVideo.mimeType || 'video/mp4');
      }
    }

    // 3. Fallback: scan outputs array
    const outputs = Array.isArray(interaction.outputs) ? interaction.outputs : [];
    for (const item of outputs) {
      const mime = item.mime_type || item.mimeType || '';
      const isVideo = item.type === 'video' || mime.startsWith('video/');
      if (!isVideo) continue;

      const uri = item.uri || item.url || item.file_uri || item.fileUri;
      if (uri) {
        return await downloadMediaAsBlob(uri, signal);
      }
      if (item.data) {
        return base64ToBlobUrl(item.data, mime || 'video/mp4');
      }
    }

    throw new Error(
      `Interaksi selesai (${interaction.status || 'ok'}), tetapi tidak ditemukan output video:\n${JSON.stringify(interaction, null, 2)}`
    );
  }

  // --- Media Download Helper ---
  async function downloadMediaAsBlob(rawUri, signal) {
    if (state.proxyAvailable) {
      const res = await fetch(`/api/download?uri=${encodeURIComponent(rawUri)}`, { signal });
      if (!res.ok) throw new Error(`Gagal mengunduh media (${res.status})`);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }

    const url = rawUri.includes('alt=media')
      ? rawUri
      : `${rawUri}${rawUri.includes('?') ? '&' : '?'}alt=media`;

    // 1. Try authenticated fetch via header
    try {
      const res = await fetch(url, {
        headers: { 'x-goog-api-key': state.apiKey },
        signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
    }

    // 2. Fallback: query param ?key=... (helps when 302 redirect strips custom headers)
    const sep = url.includes('?') ? '&' : '?';
    const urlWithKey = `${url}${sep}key=${encodeURIComponent(state.apiKey)}`;
    try {
      const res = await fetch(urlWithKey, { signal });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
      throw new Error(`Gagal mengunduh file video (${res.status} ${res.statusText})`);
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      // 3. Final fallback: let <video> stream directly if fetch is CORS-blocked on redirect
      return urlWithKey;
    }
  }

  // --- 3. Local Demo Generator (Canvas + MediaRecorder, zero API cost) ---
  async function runDemoGeneration(params, signal) {
    el.operationIdBox.textContent = `demo/operations/sim-${Math.random().toString(36).slice(2, 10)}`;
    el.operationIdBox.classList.remove('hidden');

    const stages = [
      ['[Demo] Menganalisis prompt...', 'Menyusun storyboard & gerakan kamera', 25, 'ANALISIS'],
      ['[Demo] Merender frame video...', `Aspect ${params.aspectRatio} • ${params.resolution}`, 60, 'RENDERING'],
      ['[Demo] Menggabungkan klip akhir...', 'Menyiapkan video preview lokal', 88, 'FINALISASI'],
    ];

    for (let i = 0; i < stages.length; i += 1) {
      el.pollCount.textContent = String(i + 1);
      updateLoadingState(...stages[i]);
      await sleep(950, signal);
    }

    const { url, ext } = await generateDemoCanvasVideo(params, signal);
    return {
      url,
      ext,
      filename: `veo-demo-${Date.now()}.${ext}`,
      prompt: params.prompt,
      model: `${params.model} (Demo)`,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      duration: '4s',
      createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  async function generateDemoCanvasVideo(params, signal) {
    const isPortrait = params.aspectRatio === '9:16';
    const width = isPortrait ? 450 : 800;
    const height = isPortrait ? 800 : 450;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const supportedMime =
      typeof MediaRecorder !== 'undefined'
        ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))
        : null;

    if (!supportedMime || !canvas.captureStream) {
      throw new Error('Browser ini tidak mendukung MediaRecorder untuk Mode Demo. Gunakan Chrome/Edge/Firefox terbaru atau masukkan Gemini API Key asli.');
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recordedPromise = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: supportedMime });
        resolve({
          url: URL.createObjectURL(blob),
          ext: supportedMime.includes('mp4') ? 'mp4' : 'webm',
        });
      };
      recorder.onerror = (e) => reject(e.error || new Error('Gagal merekam video demo'));
    });

    // Optional reference images for demo background (cycles smoothly across all photos)
    const refImgEls = [];
    for (const img of params.referenceImages || []) {
      const loaded = await loadImage(img.dataUrl).catch(() => null);
      if (loaded) refImgEls.push(loaded);
    }

    recorder.start();
    const totalFrames = 90; // ~3 seconds at 30fps
    const shortPrompt = params.prompt.length > 90 ? `${params.prompt.slice(0, 90)}...` : params.prompt;

    for (let f = 0; f < totalFrames; f += 1) {
      if (signal.aborted) {
        recorder.stop();
        throw new DOMException('Aborted', 'AbortError');
      }
      const t = f / totalFrames;

      // Animated gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `hsl(${(215 + t * 55) % 360}, 70%, 16%)`);
      grad.addColorStop(0.5, `hsl(${(255 + t * 40) % 360}, 62%, 22%)`);
      grad.addColorStop(1, `hsl(${(195 + t * 60) % 360}, 75%, 14%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (refImgEls.length > 0) {
        const imgIdx = Math.min(refImgEls.length - 1, Math.floor(t * refImgEls.length));
        const activeImg = refImgEls[imgIdx];
        ctx.save();
        ctx.globalAlpha = 0.5;
        const scale = 1 + t * 0.08;
        const dw = width * scale;
        const dh = height * scale;
        ctx.drawImage(activeImg, (width - dw) / 2, (height - dh) / 2, dw, dh);
        ctx.restore();
      }

      // Floating cinematic orbs
      for (let i = 0; i < 6; i += 1) {
        const angle = t * Math.PI * 2 + i * 1.1;
        const ox = width * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(angle * 0.7 + i)));
        const oy = height * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(angle + i * 0.6)));
        const radius = 55 + (i % 3) * 28;
        const orbGrad = ctx.createRadialGradient(ox, oy, 4, ox, oy, radius);
        orbGrad.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
        orbGrad.addColorStop(1, 'rgba(79, 140, 255, 0)');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Badge & Prompt Card
      ctx.fillStyle = 'rgba(9, 11, 16, 0.65)';
      ctx.fillRect(24, height - 118, width - 48, 94);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(24, height - 118, width - 48, 94);

      ctx.fillStyle = '#93c5fd';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(`VEO STUDIO • DEMO PREVIEW (${params.aspectRatio})`, 40, height - 90);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '500 16px Inter, sans-serif';
      wrapCanvasText(ctx, shortPrompt, 40, height - 62, width - 80, 22);

      await sleep(33, signal);
    }

    recorder.stop();
    return recordedPromise;
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < words.length; i += 1) {
      const testLine = line + words[i] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
        line = words[i] + ' ';
        lineCount += 1;
        if (lineCount >= 2) break;
      } else {
        line = testLine;
      }
    }
    if (lineCount < 2) {
      ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // --- UI State Helpers ---
  function startLoadingUI() {
    state.isGenerating = true;
    state.abortController = new AbortController();

    el.errorStage.classList.add('hidden');
    el.emptyStage.classList.add('hidden');
    el.playerStage.classList.add('hidden');
    el.downloadBtn.classList.add('hidden');
    el.loadingStage.classList.remove('hidden');
    el.operationIdBox.classList.add('hidden');

    el.generateBtn.disabled = true;
    el.generateBtnLabel.textContent = 'Sedang Memproses...';
    el.cancelBtn.classList.remove('hidden');

    el.pollCount.textContent = '0';
    el.elapsedTimer.textContent = '00:00';
    el.progressBar.style.width = '10%';

    const startedAt = Date.now();
    clearInterval(state.timerHandle);
    state.timerHandle = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      el.elapsedTimer.textContent = `${mm}:${ss}`;
    }, 500);
  }

  function updateLoadingState(title, subtitle, pct, statusLabel) {
    el.loadingTitle.textContent = title;
    el.loadingSubtitle.textContent = subtitle;
    el.progressBar.style.width = `${pct}%`;
    el.opStatus.textContent = statusLabel;
  }

  function stopLoadingUI() {
    state.isGenerating = false;
    clearInterval(state.timerHandle);
    el.generateBtn.disabled = false;
    el.generateBtnLabel.textContent = 'Generate Video';
    el.cancelBtn.classList.add('hidden');
  }

  function resetStageToIdle(keepError = false) {
    el.loadingStage.classList.add('hidden');
    if (state.currentVideo) {
      el.playerStage.classList.remove('hidden');
      el.downloadBtn.classList.remove('hidden');
    } else {
      el.emptyStage.classList.remove('hidden');
    }
    if (!keepError) {
      el.errorStage.classList.add('hidden');
    }
  }

  function displayResultVideo(video) {
    state.currentVideo = video;
    el.loadingStage.classList.add('hidden');
    el.emptyStage.classList.add('hidden');
    el.errorStage.classList.add('hidden');
    el.playerStage.classList.remove('hidden');
    el.downloadBtn.classList.remove('hidden');

    el.resultVideo.src = video.url;
    el.resultVideo.load();
    el.resultVideo.play().catch(() => {});

    el.resultPrompt.textContent = video.prompt;
    el.resultTags.innerHTML = '';
    const tags = [video.model, video.aspectRatio, video.resolution, video.duration];
    if (video.totalTokens) {
      tags.push(`${Number(video.totalTokens).toLocaleString('id-ID')} token`);
    }
    tags.forEach((text) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = text;
      el.resultTags.appendChild(span);
    });
  }

  function downloadCurrentVideo() {
    if (!state.currentVideo) return;
    const a = document.createElement('a');
    a.href = state.currentVideo.url;
    a.download = state.currentVideo.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function addToHistory(video) {
    state.history.unshift(video);
    renderHistory();
  }

  function clearHistory() {
    state.history.forEach((v) => {
      if (v.url !== state.currentVideo?.url) {
        URL.revokeObjectURL(v.url);
      }
    });
    state.history = [];
    renderHistory();
  }

  function renderHistory() {
    el.historyCount.textContent = String(state.history.length);
    el.clearHistoryBtn.classList.toggle('hidden', state.history.length === 0);

    if (state.history.length === 0) {
      el.historyList.innerHTML = '<p class="muted empty-history">Belum ada video yang dibuat pada sesi ini.</p>';
      return;
    }

    el.historyList.innerHTML = '';
    state.history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <video muted preload="metadata"></video>
        <div class="history-card-body">
          <div class="history-card-prompt"></div>
          <div class="history-card-meta">
            <span></span>
            <span></span>
          </div>
        </div>
      `;
      const vid = card.querySelector('video');
      vid.src = item.url;
      card.querySelector('.history-card-prompt').textContent = item.prompt;
      const metaSpans = card.querySelectorAll('.history-card-meta span');
      metaSpans[0].textContent = `${item.aspectRatio} • ${item.duration}`;
      metaSpans[1].textContent = item.createdAt;
      card.addEventListener('click', () => displayResultVideo(item));
      el.historyList.appendChild(card);
    });
  }

  function showError(message, hint = '') {
    el.errorMessage.textContent = message;
    el.errorHint.textContent = hint;
    el.errorHint.classList.toggle('hidden', !hint);
    el.errorStage.classList.remove('hidden');
  }

  function getHelpfulHint(msg, params) {
    const lower = msg.toLowerCase();
    if (lower.includes('not found') || lower.includes('404') || lower.includes('no longer available')) {
      return `Model "${params.model}" mungkin tidak aktif di endpoint ini. Jika memakai Google AI Studio API Key, coba ganti Mode Endpoint ke "Gemini Omni (/interactions)" dengan model "gemini-omni-1.2-flash", atau periksa model Veo GA aktif di Google Cloud/Vertex AI.`;
    }
    if (lower.includes('401') || lower.includes('403') || lower.includes('api key')) {
      return 'Periksa kembali GEMINI_API_KEY Anda dan pastikan billing / akses model video sudah aktif di Google AI Studio atau Google Cloud.';
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return 'Kuota API atau rate limit telah tercapai. Tunggu beberapa saat atau periksa kuota akun Google AI Anda.';
    }
    if (lower.includes('failed to fetch') || lower.includes('cors') || lower.includes('networkerror')) {
      return 'Terjadi kendala jaringan atau CORS browser. Jalankan aplikasi melalui server proxy lokal (node server.js) agar permintaan diteruskan dari backend.';
    }
    return '';
  }

  // --- Utilities ---
  function buildHeaders(includeJson = true) {
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (!state.proxyAvailable && state.apiKey) {
      headers['x-goog-api-key'] = state.apiKey;
    }
    return headers;
  }

  async function parseJsonOrThrow(res) {
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
      }
      throw new Error(`Respons server bukan JSON valid: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      const apiMsg = data?.error?.message || data?.message || JSON.stringify(data, null, 2);
      throw new Error(`HTTP ${res.status}: ${apiMsg}`);
    }
    return data;
  }

  function base64ToBlobUrl(b64, mimeType) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const id = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      function onAbort() {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      }
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  // --- Live Liquid Glass Background Engine ---
  const LIVE_BG_ORDER = ['aurora', 'sunset', 'ocean', 'off'];
  const LIVE_BG_THEMES = {
    aurora: {
      label: 'Live: Aurora',
      baseTop: '#05060d',
      baseBottom: '#0b091a',
      blobs: [
        [10, 132, 255, 0.42],   // iOS Blue
        [191, 90, 242, 0.36],   // iOS Purple
        [94, 92, 230, 0.34],    // iOS Indigo
        [255, 159, 10, 0.24],   // iOS Amber
        [100, 210, 255, 0.26],  // iOS Teal
      ],
      ribbonA: 'rgba(10, 132, 255, 0.16)',
      ribbonB: 'rgba(191, 90, 242, 0.14)',
      pointer: [100, 210, 255],
    },
    sunset: {
      label: 'Live: Sunset',
      baseTop: '#0b050d',
      baseBottom: '#140914',
      blobs: [
        [255, 55, 95, 0.40],    // iOS Pink
        [255, 159, 10, 0.34],   // iOS Orange
        [191, 90, 242, 0.34],   // iOS Purple
        [255, 214, 10, 0.20],   // iOS Yellow
        [94, 92, 230, 0.26],    // iOS Indigo
      ],
      ribbonA: 'rgba(255, 55, 95, 0.16)',
      ribbonB: 'rgba(255, 159, 10, 0.14)',
      pointer: [255, 159, 10],
    },
    ocean: {
      label: 'Live: Ocean',
      baseTop: '#040912',
      baseBottom: '#07111e',
      blobs: [
        [100, 210, 255, 0.38],  // iOS Teal
        [10, 132, 255, 0.40],   // iOS Blue
        [48, 209, 88, 0.24],    // iOS Green
        [94, 92, 230, 0.30],    // iOS Indigo
        [56, 189, 248, 0.26],   // Sky Cyan
      ],
      ribbonA: 'rgba(100, 210, 255, 0.16)',
      ribbonB: 'rgba(48, 209, 88, 0.12)',
      pointer: [100, 210, 255],
    },
    off: {
      label: 'Live: Jeda',
    },
  };

  function initLiveBackground() {
    const canvas = el.liveBgCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!LIVE_BG_THEMES[state.liveBgMode]) {
      state.liveBgMode = 'aurora';
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let width = 0;
    let height = 0;
    let rafId = 0;
    let lastTime = performance.now();
    let phase = 0;
    let speedMult = 1;

    const pointer = { x: 0.5, y: 0.38, tx: 0.5, ty: 0.38, active: false };
    const motes = Array.from({ length: 26 }, (_, idx) => ({
      x: (idx * 0.6180339) % 1,
      y: (idx * 0.381966) % 1,
      r: 1.4 + (idx % 4) * 1.1,
      speed: 0.012 + (idx % 5) * 0.005,
      drift: (idx % 2 === 0 ? 1 : -1) * (0.004 + (idx % 3) * 0.003),
      alpha: 0.18 + (idx % 5) * 0.08,
      phaseOffset: idx * 0.7,
    }));

    function resize() {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
      width = Math.max(320, Math.floor(window.innerWidth * scale));
      height = Math.max(240, Math.floor(window.innerHeight * scale));
      canvas.width = width;
      canvas.height = height;
    }

    function drawLiquidRibbon(themeColor, yRatio, amp, freq, phaseShift, thickness) {
      const baseY = height * yRatio;
      const grad = ctx.createLinearGradient(0, baseY - thickness, width, baseY + thickness);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, themeColor);
      grad.addColorStop(0.7, themeColor);
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      const steps = 10;
      ctx.moveTo(0, height);
      for (let i = 0; i <= steps; i += 1) {
        const rx = i / steps;
        const x = rx * width;
        const wave =
          Math.sin(rx * freq + phase + phaseShift) * amp +
          Math.cos(rx * (freq * 0.6) - phase * 0.8 + phaseShift) * (amp * 0.45);
        ctx.lineTo(x, baseY + wave);
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.fill();
    }

    function renderFrame(dt) {
      const theme = LIVE_BG_THEMES[state.liveBgMode] || LIVE_BG_THEMES.aurora;
      if (state.liveBgMode === 'off') return;

      const targetSpeed = state.isGenerating ? 2.2 : 1.0;
      speedMult += (targetSpeed - speedMult) * Math.min(1, dt * 3);
      phase += dt * 0.38 * speedMult;

      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);

      ctx.globalCompositeOperation = 'source-over';
      const bgGrad = ctx.createLinearGradient(0, 0, width * 0.4, height);
      bgGrad.addColorStop(0, theme.baseTop);
      bgGrad.addColorStop(1, theme.baseBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'screen';

      // Orbiting fluid color blooms
      const maxDim = Math.max(width, height);
      theme.blobs.forEach((b, i) => {
        const angle = phase * (0.45 + i * 0.08) + i * 1.35;
        const cx = width * (0.5 + 0.36 * Math.cos(angle * 0.85 + i * 0.7));
        const cy = height * (0.5 + 0.34 * Math.sin(angle * 0.7 + i * 1.1));
        const radius = maxDim * (0.38 + 0.08 * Math.sin(phase * 0.6 + i));

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]})`);
        g.addColorStop(0.5, `rgba(${b[0]}, ${b[1]}, ${b[2]}, ${(b[3] * 0.38).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      });

      // Flowing aurora wave ribbons
      drawLiquidRibbon(theme.ribbonA, 0.42, height * 0.09, 3.2, 0.4, height * 0.28);
      drawLiquidRibbon(theme.ribbonB, 0.62, height * 0.08, 2.6, 2.2, height * 0.24);

      // Soft interactive pointer caustic
      const px = pointer.x * width;
      const py = pointer.y * height;
      const pRadius = maxDim * 0.28;
      const [pr, pg, pb] = theme.pointer;
      const pAlpha = pointer.active ? 0.22 : 0.11;
      const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pRadius);
      pGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${pAlpha})`);
      pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, 0, width, height);

      // Gentle drifting bokeh motes
      motes.forEach((m) => {
        m.y = (m.y - m.speed * dt * speedMult + 1) % 1;
        m.x = (m.x + m.drift * dt * speedMult + 1) % 1;
        const twinkle = 0.55 + 0.45 * Math.sin(phase * 2.2 + m.phaseOffset);
        const mx = m.x * width;
        const my = m.y * height;
        const mr = m.r * (width / 700);
        ctx.fillStyle = `rgba(255, 255, 255, ${(m.alpha * twinkle).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(0.8, mr), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function tick(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      renderFrame(dt);
      if (state.liveBgMode !== 'off' && !document.hidden) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    }

    function syncLiveBgUI() {
      const theme = LIVE_BG_THEMES[state.liveBgMode] || LIVE_BG_THEMES.aurora;
      const isPaused = state.liveBgMode === 'off';
      if (el.liveBgLabel) el.liveBgLabel.textContent = theme.label;
      if (el.liveBgBtn) el.liveBgBtn.classList.toggle('is-paused', isPaused);
      canvas.classList.toggle('is-paused', isPaused);
    }

    function startLoop(forceStatic = false) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (state.liveBgMode === 'off') {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      renderFrame(0.016);
      if (!forceStatic && !document.hidden) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    }

    if (el.liveBgBtn) {
      el.liveBgBtn.addEventListener('click', () => {
        const idx = LIVE_BG_ORDER.indexOf(state.liveBgMode);
        state.liveBgMode = LIVE_BG_ORDER[(idx + 1) % LIVE_BG_ORDER.length];
        try {
          localStorage.setItem(STORAGE_KEYS.liveBgMode, state.liveBgMode);
        } catch {
          // Ignore storage quota errors
        }
        syncLiveBgUI();
        startLoop(false);
      });
    }

    window.addEventListener('resize', () => {
      resize();
      if (state.liveBgMode !== 'off') renderFrame(0.001);
    });

    window.addEventListener('pointermove', (e) => {
      pointer.tx = e.clientX / Math.max(1, window.innerWidth);
      pointer.ty = e.clientY / Math.max(1, window.innerHeight);
      pointer.active = true;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      pointer.active = false;
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.liveBgMode !== 'off' && !reducedMotion) {
        startLoop(false);
      }
    });

    resize();
    syncLiveBgUI();
    startLoop(Boolean(reducedMotion));
  }

  init();
})();
