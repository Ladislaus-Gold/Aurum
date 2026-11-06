<script>
  import { iconPath } from './icons.js';
  let { name, size = 20 } = $props();
</script>

<svg viewBox="0 0 24 24" style:width="{size}px" style:height="{size}px" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={iconPath(name)} /></svg>
