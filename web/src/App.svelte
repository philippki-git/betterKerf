<script>
  import Icon from './lib/Icon.svelte';
  import Home from './lib/Home.svelte';
  import Settings from './lib/Settings.svelte';
  import Dialog from './lib/Dialog.svelte';
  import Toast from './lib/Toast.svelte';
  import Zoom from './lib/Zoom.svelte';
  import { MODULES } from './lib/modules.js';

  // Routing: view = 'home' | 'settings' | 'module'
  let view = $state('home');
  let currentModuleId = $state(null);
  let settingsReturnId = $state(null);

  const HEADER_DEFAULT = { icon: 'checklist', sub: 'Werkstatt-Rechner für die Holzbearbeitung' };

  let activeModule = $derived(MODULES.find(m => m.id === currentModuleId) || null);

  let header = $derived(
    view === 'settings'
      ? { icon: 'settings', sub: 'Maßeinheit & App-Optionen', plainTitle: 'Einstellungen' }
      : activeModule
        ? { icon: activeModule.icon, sub: activeModule.sub, plainTitle: activeModule.title }
        : { icon: HEADER_DEFAULT.icon, sub: HEADER_DEFAULT.sub, plainTitle: null }
  );

  function openModule(id) {
    const m = MODULES.find(x => x.id === id);
    if (!m || m.status !== 'ready') return;
    currentModuleId = id;
    view = 'module';
  }
  function goHome() { view = 'home'; currentModuleId = null; settingsReturnId = null; }
  function openSettings() {
    settingsReturnId = view === 'module' ? currentModuleId : null;
    view = 'settings';
  }
  function goBack() {
    if (view === 'settings' && settingsReturnId) {
      const id = settingsReturnId; settingsReturnId = null;
      openModule(id);
    } else {
      goHome();
    }
  }

  const showBack = $derived(view !== 'home');
  const showGear = $derived(view !== 'settings');

  // Swipe-Back vom linken Rand
  let x0 = 0, y0 = 0;
  function onTouchStart(e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (x0 < 30 && dx > 60 && Math.abs(dy) < 80 && showBack) goBack();
  }
</script>

<svelte:window ontouchstart={onTouchStart} ontouchend={onTouchEnd} />

<!-- gemountet in #app (siehe index.html), daher hier kein erneuter #app-Wrapper -->
<div class="header">
    <button class="header-back" class:show={showBack} onclick={goBack} aria-label="Zurück">‹</button>
    <div class="header-icon"><Icon name={header.icon} size={20} /></div>
    <div class="header-titles">
      <h1>
        {#if header.plainTitle}{header.plainTitle}{:else}<span class="bk-better">better</span><span class="bk-kerf">Kerf</span>{/if}
      </h1>
      <p>{header.sub}</p>
    </div>
    <button class="header-gear" class:hidden={!showGear} onclick={openSettings} aria-label="Einstellungen">
      <Icon name="settings" size={20} />
    </button>
  </div>

  {#if view === 'home'}
    <Home onopen={openModule} />
  {:else if view === 'settings'}
    <Settings />
  {:else if activeModule && activeModule.component}
    {#key currentModuleId}
      {@const ModuleComp = activeModule.component}
      <div class="screen active">
        <ModuleComp />
      </div>
    {/key}
  {/if}

<Dialog />
<Toast />
<Zoom />
