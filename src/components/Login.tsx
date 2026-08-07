import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import escudo from "@/assets/escudo.jpeg";
import { useAuthStore } from "@/store/useAuthStore";

export function Login() {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      // el mensaje de error ya queda expuesto vía el store
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm rounded-xl2 border border-base-700 bg-base-850 p-8 shadow-soft">
        <div className="flex flex-col items-center mb-6">
          <img
            src={escudo}
            alt="Escudo Metegol FC"
            className="h-16 w-16 rounded-lg object-contain bg-white/95 p-1 ring-1 ring-accent-green/30 mb-3"
          />
          <h1 className="text-xl font-bold text-white">Metegol FC</h1>
          <p className="text-sm text-gray-500">Ingresá con tu usuario</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-gray-100 outline-none focus:ring-1 focus:ring-accent-green"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-base-950 shadow-soft hover:bg-accent-emerald transition-colors disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          ¿No tenés usuario o te olvidaste la contraseña? Pedíselo al administrador del equipo.
        </p>
      </div>
    </div>
  );
}
