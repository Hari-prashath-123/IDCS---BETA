import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthHeader from "../components/AuthHeader";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');
  
  // capture any uncaught errors and show them in the UI for debugging
  React.useEffect(() => {
    const handler = (event) => {
      try {
        const message = event && event.message ? event.message : String(event);
        setDebugMsg(`Unhandled error: ${message}`)
      } catch (e) {}
    }
    window.addEventListener('error', handler)
    window.addEventListener('unhandledrejection', (ev) => {
      try { setDebugMsg(`Unhandled promise rejection: ${ev.reason?.message || String(ev.reason)}`) } catch (e) {}
    })
    return () => {
      window.removeEventListener('error', handler)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Delegate routing to AuthProvider.login which handles fetching the profile
      setDebugMsg('Attempting login...')
      console.debug('Login: attempting login for', identifier)
      try {
        await login(identifier, password);
        setDebugMsg('Login request sent — awaiting redirect from AuthProvider')
      } catch (e) {
        // show immediate error
        const msg = (e && e.message) || 'Login failed'
        setDebugMsg(`Login error: ${msg}`)
        throw e
      }
      // AuthProvider will perform navigation based on profile; no further action here
    } catch (err) {
      const msg =
        (err && err.message) || "Invalid email or password. Please try again.";
      setError(msg);
      setDebugMsg(`Login error: ${msg}`)
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col pt-16">
      <AuthHeader />
      {debugMsg && (
        <div className="max-w-md w-full mx-auto mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">{debugMsg}</div>
      )}
      <div className="flex-1 flex items-center justify-center px-4 py-12 md:py-16">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Email or Register No
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="College Email or Reg. No."
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
