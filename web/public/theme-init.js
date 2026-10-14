// Applies the saved theme before first paint (kept as a file so the
// Content Security Policy can forbid inline scripts).
try {
  var t = localStorage.getItem("sentience.theme") || "system";
  var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (e) {}
