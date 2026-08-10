import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  CreditCard,
  Bell,
  Sliders,
  Trash2,
  Globe,
  Info,
  MessageSquare,
  LogOut,
  Check,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsPageProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onBackToSwipe: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onBackToSwipe,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleClearCache = () => {
    showToast('已清理缓存 12.4 MB');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900 pb-24 select-none">
      {/* Toast Popup */}
      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#FFD100]" />
          {toastMessage}
        </div>
      )}

      {/* Meituan Exact Style Settings Header */}
      <div className="sticky top-0 bg-[#F5F5F7]/90 backdrop-blur-md z-30 px-4 py-3 flex items-center justify-between border-b border-gray-200/50">
        <button
          onClick={onBackToSwipe}
          className="p-1 -ml-1 text-gray-800 hover:text-black transition-colors"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2]" />
        </button>
        <h1 className="text-base font-bold text-gray-900">设置</h1>
        <div className="w-6" /> {/* Placeholder for alignment */}
      </div>

      {/* Settings Groups - Standard Meituan Cards */}
      <div className="p-3 space-y-3 max-w-md mx-auto">
        {/* Group 1: Account & Address */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100/80 divide-y divide-gray-100">
          <button
            onClick={() => setActiveModal('profile')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">个人信息</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">吃货专员 · 138****8888</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setActiveModal('address')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">收货地址</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 truncate max-w-[140px]">{settings.address}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        </div>

        {/* Group 2: Account Security & Privacy */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100/80 divide-y divide-gray-100">
          <button
            onClick={() => showToast('账号安全良好')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">账号安全</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{settings.accountStatus}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => showToast('已开启保护模式')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">隐私设置</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Group 3: Preferences & System */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100/80 divide-y divide-gray-100">
          <button
            onClick={() => showToast('微信支付 / 支付宝未变动')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">支付设置</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={() => showToast('消息通知已设为最佳提示')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">消息通知</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={() => showToast('通用设置已刷新')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">通用设置</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={handleClearCache}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">清理缓存</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Group 4: Modes & Language (Exact match with Meituan screenshot) */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100/80 divide-y divide-gray-100">
          <button
            onClick={() => {
              onUpdateSettings({ elderMode: !settings.elderMode });
              showToast(settings.elderMode ? '已关闭长辈版' : '已切换至大字长辈版');
            }}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">长辈版</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">
                {settings.elderMode ? '已开启' : '未开启'}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => {
              onUpdateSettings({ minorMode: !settings.minorMode });
              showToast(settings.minorMode ? '已关闭未成年人模式' : '已开启未成年人模式');
            }}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">未成年人模式</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">
                {settings.minorMode ? '已开启' : '未开启'}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setActiveModal('language')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">语言切换/Language</span>
            <div className="flex items-center gap-1">
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1 py-0.2 rounded mr-1">
                文A
              </span>
              <span className="text-xs text-gray-400">{settings.language}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        </div>

        {/* Group 5: About & Feedback */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100/80 divide-y divide-gray-100">
          <button
            onClick={() => showToast('已是最新版本 v12.18.401')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">关于美团</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-500 font-bold flex items-center gap-0.5">
                发现新版本 <span className="text-red-500 text-xs">●</span>
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => showToast('感谢您的反馈！支持随时在AI Studio提交要求')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">意见反馈</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Logout Button */}
        <div className="pt-2">
          <button
            onClick={() => showToast('已退出当前账号')}
            className="w-full bg-white text-gray-800 hover:text-red-600 font-bold py-3.5 rounded-2xl shadow-xs border border-gray-100 active:bg-gray-50 transition-colors text-sm"
          >
            退出登录
          </button>
        </div>
      </div>

      {/* Address Edit Modal */}
      {activeModal === 'address' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-3">修改默认收货地址</h3>
            <input
              type="text"
              defaultValue={settings.address}
              onChange={(e) => onUpdateSettings({ address: e.target.value })}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:border-[#FFD100]"
            />
            <button
              onClick={() => {
                setActiveModal(null);
                showToast('收货地址修改成功');
              }}
              className="w-full bg-[#FFD100] text-gray-900 font-bold py-2 rounded-xl text-xs hover:bg-[#ffc800]"
            >
              保存修改
            </button>
          </div>
        </div>
      )}

      {/* Language Modal */}
      {activeModal === 'language' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-3">选择界面语言 / Language</h3>
            <div className="space-y-2 mb-4 text-xs">
              {['简体中文', '繁體中文', 'English'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    onUpdateSettings({ language: lang });
                    setActiveModal(null);
                    showToast(`已切换语言为 ${lang}`);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between ${
                    settings.language === lang
                      ? 'border-[#FFD100] bg-amber-50 font-bold text-gray-900'
                      : 'border-gray-100 text-gray-600'
                  }`}
                >
                  <span>{lang}</span>
                  {settings.language === lang && <Check className="w-4 h-4 text-amber-600" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
