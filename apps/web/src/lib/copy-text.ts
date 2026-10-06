/**
 * Copies text to the clipboard, including where `navigator.clipboard` is absent.
 *
 * The Clipboard API is secure-context only. This app is served over plain HTTP
 * on an IP address, where `navigator.clipboard` is `undefined` — a copy button
 * written against it does nothing at all, with no error for the user to notice.
 * The deprecated `execCommand("copy")` path carries no such restriction and is
 * the only thing that works there.
 *
 * Returns whether the copy actually happened, so the caller can avoid showing a
 * "Copied" confirmation for something that never reached the clipboard.
 */
export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission denied or a transient failure: fall through to the shim
    }
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // kept in the document but out of view: execCommand only copies from an
    // element that is actually selectable, so `display: none` would fail
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};
