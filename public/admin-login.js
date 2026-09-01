const DEFAULT_TIMEOUT_MS = 10_000;

export function createAdminLogin({ form, errorBox, fetchFn = fetch, onAuthenticated, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  let pending = false;
  return async function submitAdminLogin(event) {
    event.preventDefault();
    if (pending) return false;
    const button = form.querySelector('button[type="submit"], button');
    const originalLabel = button.textContent;
    pending = true; button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Signing in…'; errorBox.textContent = '';
    const controller = new window.AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const password = new FormData(form).get('password');
      const response = await fetchFn('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ password }), signal:controller.signal });
      const data = await response.json();
      if (!response.ok) { errorBox.textContent = data.error || 'Sign in failed.'; return false; }
      form.reset(); onAuthenticated(); return true;
    } catch (error) {
      errorBox.textContent = error?.name === 'AbortError' ? 'Sign in timed out. No additional request was sent; please try again.' : 'Sign in could not be completed. Please check your connection.';
      return false;
    } finally {
      clearTimeout(timer); pending = false; button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = originalLabel;
    }
  };
}
