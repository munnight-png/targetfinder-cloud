import React, { useState } from 'react';
import { useStore } from '../store';
import axios from 'axios';
import { Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuthorized = useStore((state) => state.setAuthorized);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const VITE_API_URL = import.meta.env.VITE_API_URL;
      const BASE_URL = VITE_API_URL && VITE_API_URL.startsWith('http') ? VITE_API_URL : (VITE_API_URL || '');
      const loginUrl = `${BASE_URL.replace(/\/$/, '')}/api/login`;
      
      const response = await axios.post(loginUrl, { password });
      
      if (response.data.success) {
        setAuthorized(true, password);
      }
    } catch (err: any) {
      const detail = err.response?.data?.message || err.message;
      setError(`로그인 실패: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900 z-[9999]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-3xl bg-slate-800/50 border border-slate-700 backdrop-blur-xl shadow-2xl mx-4"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">타겟파인더 보안 접속</h1>
          <p className="text-slate-400">데이터 보호를 위해 마스터 비밀번호를 입력해주세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full h-14 bg-slate-900/50 border border-slate-700 rounded-2xl px-6 text-white text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
              <ShieldCheck size={24} />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm px-2"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold text-lg rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-700/50 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
            Project TargetFinder Secure Access
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
