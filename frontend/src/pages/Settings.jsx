import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Loader2, CheckCircle, Eraser } from 'lucide-react';
import { settingsAPI } from '../utils/api';

export default function Settings() {
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsAPI.get();
        setFields(data.fields || []);
      } catch (err) {
        setError(err.message || 'Không tải được cấu hình');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleClear = (key) => {
    setForm((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      // Secret fields: only send when the user actually typed something (or
      // explicitly cleared it), so leaving them blank never wipes a saved key.
      const payload = {};
      for (const field of fields) {
        if (!(field.key in form)) continue;
        if (field.secret && form[field.key] === undefined) continue;
        payload[field.key] = form[field.key];
      }

      await settingsAPI.save(payload);
      const data = await settingsAPI.get();
      setFields(data.fields || []);
      setForm({});
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fadeIn flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Đang tải cấu hình...
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <SettingsIcon size={24} className="text-slate-500" />
          Cài đặt
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          API key và cấu hình được lưu trên máy này, không đóng gói trong file cài đặt app.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {field.label}
              {field.secret && field.configured && (
                <span className="ml-2 text-xs font-normal text-emerald-600">đã thiết lập ({field.value})</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type={field.secret ? 'password' : 'text'}
                value={field.secret ? (form[field.key] ?? '') : (form[field.key] ?? field.value)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.secret ? (field.configured ? 'Nhập giá trị mới để thay thế' : 'Chưa thiết lập') : ''}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              />
              {field.secret && field.configured && (
                <button
                  type="button"
                  onClick={() => handleClear(field.key)}
                  title="Xóa giá trị đã lưu"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  <Eraser size={16} />
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="gradient-bg text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu cấu hình
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle size={16} /> Đã lưu
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
