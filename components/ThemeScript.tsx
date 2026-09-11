/**
 * Applies light or dark before first paint.
 *
 * Without this the page renders light and then snaps to dark, which on a
 * home-screen app is a visible flash of white every time it opens. Light is the
 * stylesheet's base, so it needs no attribute and cannot flash; dark is stamped
 * here, ahead of the first paint.
 *
 * With nothing saved the phone decides, so a dark-mode phone opens dark. Only
 * the two names are ever written to the attribute — anything else in storage
 * (including the old colourway names) falls through to light.
 */
export function ThemeScript() {
  const code = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("amacomp-palette");var dark=p==="dark"||(!p&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark){d.setAttribute("data-palette","dark");}else{d.removeAttribute("data-palette");}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
