import { CHRISTMAS, FESTIVE_KEY } from "@/lib/festive";

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
  // The Christmas look (lib/festive) is stamped here too, from the phone's own
  // date, so the pine and the lights are there on the first frame rather than
  // arriving after React does. FestiveProvider keeps it in sync after that.
  const xmas = `var n=new Date(),k=n.getFullYear()+"-"+("0"+(n.getMonth()+1)).slice(-2)+"-"+("0"+n.getDate()).slice(-2),f=localStorage.getItem("${FESTIVE_KEY}");if(f==="on"||(f!=="off"&&k>="${CHRISTMAS.from}"&&k<="${CHRISTMAS.to}")){d.setAttribute("data-festive","xmas");}`;
  const code = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("amacomp-palette");var dark=p==="dark"||(!p&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark){d.setAttribute("data-palette","dark");}else{d.removeAttribute("data-palette");}${xmas}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
