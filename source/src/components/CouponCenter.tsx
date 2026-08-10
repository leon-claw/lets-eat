import React, { useState } from 'react';
import { Tag, Sparkles, Gift, Flame, CheckCircle2, Copy } from 'lucide-react';

export const CouponCenter: React.FC = () => {
  const [claimedCoupons, setClaimedCoupons] = useState<number[]>([]);

  const coupons = [
    { id: 1, amount: 15, title: '天天吃神券', condition: '满38元可用', store: '美团外卖全场通用', tag: '限时抢' },
    { id: 2, amount: 8, title: '品质堂食券', condition: '满25元可用', store: '必点榜/品牌大牌商家', tag: '爆款推荐' },
    { id: 3, amount: 20, title: '夜宵专享券', condition: '满50元可用', store: '小龙虾/烧烤/炸鸡通用', tag: '夜宵神器' },
    { id: 4, amount: 5, title: '无门槛立减券', condition: '无门槛', store: '首单立减', tag: '新客福利' },
  ];

  const handleClaim = (id: number) => {
    if (!claimedCoupons.includes(id)) {
      setClaimedCoupons([...claimedCoupons, id]);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto pb-24 space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#FFD100] to-amber-400 p-4 rounded-2xl text-gray-900 shadow-md flex items-center justify-between">
        <div>
          <span className="bg-black text-[#FFD100] font-black text-[9px] px-2 py-0.5 rounded">
            美团神券节
          </span>
          <h2 className="text-lg font-black mt-1">天天领外卖红包</h2>
          <p className="text-xs text-gray-800 font-medium">选菜前先领券，单单省大钱！</p>
        </div>
        <Gift className="w-12 h-12 text-gray-900 opacity-90 shrink-0" />
      </div>

      {/* Coupon Cards */}
      <div className="space-y-3">
        {coupons.map((c) => {
          const isClaimed = claimedCoupons.includes(c.id);

          return (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 flex items-center justify-between relative overflow-hidden"
            >
              {/* Left Notch and Right Notch style decorative cutout */}
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#F5F5F7] rounded-full" />
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#F5F5F7] rounded-full" />

              <div className="flex items-center gap-3 pl-2">
                <div className="text-center shrink-0 pr-3 border-r border-dashed border-gray-200">
                  <div className="text-xs font-bold text-red-600">
                    ¥<span className="text-2xl font-black">{c.amount}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">{c.condition}</div>
                </div>

                <div>
                  <div className="flex items-center gap-1">
                    <span className="bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      {c.tag}
                    </span>
                    <h4 className="font-extrabold text-xs text-gray-900">{c.title}</h4>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{c.store}</p>
                </div>
              </div>

              <button
                onClick={() => handleClaim(c.id)}
                disabled={isClaimed}
                className={`text-xs font-black px-4 py-2 rounded-full shadow-xs shrink-0 transition-all active:scale-95 ${
                  isClaimed
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-[#FFD100] hover:bg-[#ffc800] text-gray-900'
                }`}
              >
                {isClaimed ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 已领取
                  </span>
                ) : (
                  '立即领取'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
