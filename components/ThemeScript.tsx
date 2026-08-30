/**
 * Applies the saved colourway before first paint.
 *
 * Without this the page renders in Deck and then snaps to the chosen scheme,
 * which on a home-screen app is a visible flash of the wrong colour every time
 * it opens. Deck is the stylesheet's base, so it needs no attribute and cannot
 * flash; every other scheme is stamped here, ahead of the first paint.
 *
 * The regex is the guard: whatever is in localStorage becomes an attribute
 * value, so it is held to a short lowercase name rather than trusted.
 */
export function ThemeScript() {
  const code = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("amacomp-palette");if(p&&/^[a-z]{4,8}$/.test(p)&&p!=="deck"){d.setAttribute("data-palette",p);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
