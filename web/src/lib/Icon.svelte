<script>
  import { MS } from './icons.js';
  let { name, size = 20 } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
  <path d={MS[name]} />
</svg>
