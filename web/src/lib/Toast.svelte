<script>
  import Icon from './Icon.svelte';
  import { toastState } from './dialog.svelte.js';
</script>

<div class="toast" class:show={!!toastState.current}>
  {#if toastState.current}
    <Icon name="check_circle" size={16} /> {toastState.current.msg}
  {/if}
</div>
