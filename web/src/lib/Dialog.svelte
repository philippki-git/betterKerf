<script>
  import Icon from './Icon.svelte';
  import { dlgState, resolveDialog } from './dialog.svelte.js';

  const btnClass = {
    confirm: 'dlg-btn-confirm',
    danger: 'dlg-btn-danger',
    cancel: 'dlg-btn-cancel',
    ok: 'dlg-btn-ok'
  };
</script>

{#if dlgState.current}
  {@const d = dlgState.current}
  <div class="dlg-overlay show">
    <div class="dlg">
      <div class="dlg-icon" style:color={d.danger ? 'var(--danger)' : 'var(--text3)'}>
        <Icon name={d.icon} size={32} />
      </div>
      <div class="dlg-title">{d.title}</div>
      <div class="dlg-msg">{d.msg}</div>
      <div class="dlg-btns">
        {#each d.buttons as b}
          <button class="dlg-btn {btnClass[b.kind]}" onclick={() => resolveDialog(b.val)}>{b.label}</button>
        {/each}
      </div>
    </div>
  </div>
{/if}
