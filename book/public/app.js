// Small progressive enhancements. Every form works without this file.
document.addEventListener("input", (e) => {
  const name = e.target.closest("[data-slug-from]");
  if (!name) return;
  const slug = document.querySelector("[data-slug]");
  if (slug && !slug.dataset.touched) slug.value = name.value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
});
document.addEventListener("change", (e) => { if (e.target.matches("[data-slug]")) e.target.dataset.touched = "1"; });
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch { b.textContent = "Select the link to copy"; }
});
