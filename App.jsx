import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Settings, Volume2, LayoutGrid, Package, Coffee, Trash2, ShoppingBag, X } from 'lucide-react';
import liff from '@line/liff';

// ==========================================
// 🛠️ 設定區
// ==========================================
const CONFIG = {
    // 1. LIFF ID
    liffId: "2008979082-w7Tz842F",

    // 2. SheetDB 網址 (請換成您的!)
    // 格式範例: "https://sheetdb.io/api/v1/您的ID"
    sheetDbUrl: "https://sheetdb.io/api/v1/jpgj0nm7sljvk" 
};
// ==========================================

export default function App() {
    // 資料狀態
    const [shopState, setShopState] = useState({ name: "載入中...", isOpen: false, notices: [], password: "" });
    const [menuData, setMenuData] = useState({ combos: [], items: [] });
    const [cart, setCart] = useState([]);
    
    // UI 狀態
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCart, setShowCart] = useState(false); 
    const [adminStep, setAdminStep] = useState(0); 
    const [inputPwd, setInputPwd] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('菜單載入中...');
    
    // 訂單資訊
    const [globalNote, setGlobalNote] = useState('');
    const tzOffset = (new Date()).getTimezoneOffset() * 60000; 
    const localISODate = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    const [pickupDate, setPickupDate] = useState(localISODate);
    const [pickupTime, setPickupTime] = useState('');

    useEffect(() => {
        // 1. 初始化 LIFF
        const script = document.createElement('script');
        script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => {
            if (window.liff) {
                window.liff.init({ liffId: CONFIG.liffId })
                    .then(() => { 
                        if (!window.liff.isLoggedIn() && window.liff.isInClient()) {
                            window.liff.login(); 
                        }
                    })
                    .catch(console.error);
            }
        };

        // 2. 從 SheetDB 載入資料
        const loadData = async () => {
            try {
                // 平行讀取 Menu 和 Settings 分頁
                const [menuRes, settingsRes] = await Promise.all([
                    fetch(`${CONFIG.sheetDbUrl}?sheet=Menu`).then(r => r.json()),
                    fetch(`${CONFIG.sheetDbUrl}?sheet=Settings`).then(r => r.json())
                ]);

                // 處理設定
                if (settingsRes && settingsRes.length > 0) {
                    const s = settingsRes[0];
                    setShopState({
                        name: s.name || "點餐系統",
                        isOpen: String(s.isOpen).toUpperCase() === "TRUE",
                        notices: s.notices ? s.notices.split('|') : [],
                        password: s.password
                    });
                }

                // 處理菜單
                const combos = [];
                const items = [];
                menuRes.forEach(row => {
                    // 轉型處理，避免資料庫是字串導致錯誤
                    const item = {
                        id: row.id,
                        type: row.type,
                        name: row.name,
                        price: parseInt(row.price || 0),
                        info: row.info,
                        mainOptions: row.mainOptions ? row.mainOptions.split(',') : [],
                        soupOptions: row.soupOptions ? row.soupOptions.split(',') : []
                    };
                    if (item.type === '套餐') combos.push(item);
                    else items.push(item);
                });

                setMenuData({ combos, items });
                setIsLoading(false);

            } catch (e) {
                console.error(e);
                setLoadingMsg("連線失敗，請檢查 SheetDB 設定");
            }
        };

        loadData();
    }, []);

    const displayItems = useMemo(() => {
        const all = [...menuData.combos, ...menuData.items];
        if (activeCategory === 'all') return all;
        if (activeCategory === 'combo') return menuData.combos;
        if (activeCategory === 'single') return menuData.items;
        return all;
    }, [menuData, activeCategory]);

    const forceCopy = (text) => {
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
        try {
            const t = document.createElement("textarea");
            t.value = text; t.style.position = "fixed"; t.style.left = "-9999px";
            document.body.appendChild(t); t.focus(); t.select(); 
            document.execCommand('copy'); document.body.removeChild(t);
        } catch (e) {}
    };

    const getFlexMessage = (cart, total, note, pDate, pTime) => {
        const itemsRows = cart.map(item => ({
            type: "box", layout: "vertical", margin: "md",
            contents: [
                {
                    type: "box", layout: "horizontal",
                    contents: [
                        { type: "text", text: item.name, size: "md", weight: "bold", color: "#333333", flex: 6, wrap: true },
                        { type: "text", text: `x${item.quantity}`, size: "sm", color: "#666666", align: "center", flex: 2 },
                        { type: "text", text: `$${item.displayPrice}`, size: "sm", weight: "bold", color: "#ea580c", align: "end", flex: 3 }
                    ]
                },
                item.customs && { type: "text", text: `└ ${item.customs}`, size: "xs", color: "#9ca3af", wrap: true, margin: "xs", offsetStart: "md" }
            ].filter(Boolean)
        }));

        return {
            type: "bubble",
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: "訂單已建立", weight: "bold", color: "#10b981", size: "sm" },
                    { type: "text", text: shopState.name, weight: "bold", size: "xl", margin: "md" },
                    { 
                        type: "box", layout: "vertical", margin: "md", backgroundColor: "#fff7ed", cornerRadius: "md", paddingAll: "md",
                        contents: [
                            { type: "text", text: "🕒 預定取餐時間", size: "xs", color: "#ea580c", weight: "bold" },
                            { type: "text", text: `${pDate} ${pTime}`, size: "lg", color: "#333333", weight: "bold", margin: "sm" }
                        ]
                    },
                    { type: "text", text: "狀態：等待店家確認 ✅", weight: "bold", size: "xs", color: "#10b981", align: "center", margin: "lg" },
                    { type: "separator", margin: "lg" },
                    { type: "box", layout: "vertical", margin: "lg", contents: itemsRows },
                    { type: "separator", margin: "lg", color: "#e5e7eb" },
                    {
                        type: "box", layout: "horizontal", margin: "lg",
                        contents: [
                            { type: "text", text: "總計", size: "md", color: "#6b7280", weight: "bold", gravity: "bottom" },
                            { type: "text", text: `$${total}`, size: "2xl", color: "#ea580c", align: "end", weight: "bold" }
                        ]
                    },
                    note ? { 
                        type: "box", layout: "vertical", margin: "lg", backgroundColor: "#f3f4f6", cornerRadius: "md", paddingAll: "md",
                        contents: [
                            { type: "text", text: "備註事項：", size: "xs", color: "#6b7280", weight: "bold" },
                            { type: "text", text: note, size: "sm", color: "#374151", wrap: true, margin: "xs" }
                        ]
                    } : { type: "spacer" }
                ]
            }
        };
    };

    const submitOrder = async () => {
        if (cart.length === 0) return;
        if (!pickupDate || !pickupTime) { alert("❌ 請選擇「預定取餐的日期與時間」！"); return; }
        
        setIsUpdating(true);

        const total = cart.reduce((s, i) => s + i.displayPrice, 0);
        const flexMsg = getFlexMessage(cart, total, globalNote, pickupDate, pickupTime);
        const clientTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
        
        let textMsg = `📋 新訂單 ${clientTime}\n🕒 取餐：${pickupDate} ${pickupTime}\n----------------\n`;
        cart.forEach(i => textMsg += `${i.name} x${i.quantity} ${i.customs ? '('+i.customs+')' : ''}\n`);
        textMsg += `----------------\n💰 總計：$${total}`;
        if(globalNote) textMsg += `\n備註：${globalNote}`;

        forceCopy(textMsg);

        try {
            // 1. 寫入 SheetDB (超簡單！)
            const prettyCart = cart.map(i => `${i.name}${i.customs ? '('+i.customs+')' : ''} x${i.quantity}`).join('\n');
            const backendNote = `[取餐: ${pickupDate} ${pickupTime}] ${globalNote}`;
            
            await fetch(`${CONFIG.sheetDbUrl}?sheet=Orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        time: clientTime,
                        total: total,
                        content: prettyCart,
                        note: backendNote
                    }
                })
            });
            
            // 2. 傳送 LINE
            let sent = false;
            if (window.liff && window.liff.isInClient()) {
                try {
                    await window.liff.sendMessages([{ type: 'flex', altText: `🍱 訂單 $${total}`, contents: flexMsg }]);
                    window.liff.closeWindow(); sent = true;
                } catch (err) {
                    if (window.liff.isApiAvailable('shareTargetPicker')) {
                        const res = await window.liff.shareTargetPicker([{ type: 'flex', altText: `🍱 訂單 $${total}`, contents: flexMsg }]);
                        if (res) { window.liff.closeWindow(); sent = true; }
                    }
                }
            }

            if (!sent) {
                alert("✅ 訂單已建立！\n請點擊「確定」開啟 LINE 傳送給店家。");
                window.location.href = "https://line.me/R/msg/text/?" + encodeURIComponent(textMsg);
            }
            setCart([]); setShowCart(false);
        } catch(e) {
            alert("⚠️ 寫入失敗，將開啟文字傳送");
            window.location.href = "https://line.me/R/msg/text/?" + encodeURIComponent(textMsg);
        } finally {
            setIsUpdating(false);
        }
    };

    // 切換營業狀態 (寫回 SheetDB)
    const toggleStatus = async (status) => {
        setIsUpdating(true);
        try {
            if (inputPwd !== shopState.password) {
                alert("❌ 密碼錯誤");
                setIsUpdating(false);
                return;
            }
            
            // 使用 SheetDB 的 PATCH 功能更新 Settings 表格的第一列
            // 假設只有一列，我們用 lookup 方式或者直接抓取 (SheetDB 支援直接針對 value 更新)
            // 這裡我們用簡單的 update 語法
            await fetch(`${CONFIG.sheetDbUrl}/name/${shopState.name}?sheet=Settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: { "isOpen": status === 'Y' ? "TRUE" : "FALSE" }
                })
            });
            
            setShopState(prev => ({ ...prev, isOpen: (status === 'Y') }));
            alert("✅ 狀態已更新！");
            setAdminStep(0);
        } catch(e) { 
            alert("更新失敗，請檢查網路"); 
        }
        setIsUpdating(false);
    };

    // ... 購物車與介面邏輯 ...
    const removeFromCart = (index) => {
        const newCart = cart.filter((_, i) => i !== index);
        setCart(newCart);
        if (newCart.length === 0) setShowCart(false);
    };
    const addToCart = () => {
        if (selectedItem.type === '套餐') {
            if (!selectedItem.main) { alert("❌ 請選擇主食"); return; }
            if (!selectedItem.soup) { alert("❌ 請選擇湯品/飲品"); return; }
        }
        const addonPrice = (selectedItem.addons || []).length * 10;
        const totalP = (selectedItem.basePrice + addonPrice) * selectedItem.quantity;
        const customs = [
            selectedItem.main ? `主食:${selectedItem.main}` : '',
            selectedItem.soup ? `湯品:${selectedItem.soup}` : '',
            selectedItem.spicy,
            ...(selectedItem.addons || []),
            selectedItem.itemNote ? `備註:${selectedItem.itemNote}` : ''
        ].filter(Boolean);
        
        setCart([...cart, { ...selectedItem, displayPrice: totalP, customs: customs.join(' / ') }]);
        setSelectedItem(null); 
    };
    const showExtras = selectedItem && (selectedItem.type === '套餐' || selectedItem.name.includes('飯') || selectedItem.name.includes('麵'));

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col justify-center items-center z-[9999]">
                <div className="w-10 h-10 border-4 border-gray-100 border-t-orange-600 rounded-full animate-spin"></div>
                <div className="mt-4 text-lg font-bold text-gray-600 tracking-wide">連線中...</div>
                <div className="text-xs text-red-500 mt-2 px-4 text-center">{loadingMsg !== '菜單載入中...' ? loadingMsg : ''}</div>
                {loadingMsg.includes('失敗') && <button onClick={()=>window.location.reload()} className="mt-4 text-gray-400 underline">重整</button>}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative shadow-2xl overflow-hidden pb-24 font-sans selection:bg-orange-200 selection:text-orange-900">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 pt-10 pb-4">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 ${shopState.isOpen ? 'text-green-600' : 'text-red-500'}`}>
                            <Clock size={12} /> {shopState.isOpen ? '營業中 Open' : '休息中 Closed'}
                        </span>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{shopState.name}</h1>
                    </div>
                    <button onClick={() => setAdminStep(1)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200">
                        <Settings size={20} />
                    </button>
                </div>
            </header>

            {shopState.notices.length > 0 && (
                <div className="mx-5 mt-5 mb-2 bg-orange-50/80 border border-orange-100/50 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="text-orange-500 mt-0.5 shrink-0"><Volume2 size={18} /></div>
                    <div className="text-sm text-orange-800 leading-relaxed font-medium">
                        {shopState.notices.map((n, i) => <div key={i}>{n.trim()}</div>)}
                    </div>
                </div>
            )}

            <div className="px-5 my-6 sticky top-[92px] z-20">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    <button onClick={() => setActiveCategory('all')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap font-bold text-sm transition-all duration-300 shadow-sm ${activeCategory==='all' ? 'bg-orange-600 text-white shadow-orange-600/30 transform scale-105' : 'bg-white text-gray-500 border border-gray-100'}`}>
                        <LayoutGrid size={18} /> 全部餐點
                    </button>
                    <button onClick={() => setActiveCategory('combo')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap font-bold text-sm transition-all duration-300 shadow-sm ${activeCategory==='combo' ? 'bg-orange-600 text-white shadow-orange-600/30 transform scale-105' : 'bg-white text-gray-500 border border-gray-100'}`}>
                        <Package size={18} /> 超值套餐
                    </button>
                    <button onClick={() => setActiveCategory('single')} className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap font-bold text-sm transition-all duration-300 shadow-sm ${activeCategory==='single' ? 'bg-orange-600 text-white shadow-orange-600/30 transform scale-105' : 'bg-white text-gray-500 border border-gray-100'}`}>
                        <Coffee size={18} /> 單點美味
                    </button>
                </div>
            </div>

            <div className="px-5 space-y-4">
                {displayItems.map(item => (
                    <div key={item.id} onClick={()=>setSelectedItem({...item, quantity:1, basePrice:item.price, addons:[], spicy:'不辣', main:'', soup:'', itemNote:''})} 
                         className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex justify-between items-center transition-transform hover:scale-[1.02] cursor-pointer active:scale-95 group">
                        <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                                {item.type === '套餐' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-bold uppercase">Combo</span>}
                                <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2 mt-1 leading-snug">{item.info}</p>
                        </div>
                        <div className="text-orange-600 font-black text-2xl tracking-tight bg-orange-50 px-4 py-2 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            ${item.price}
                        </div>
                    </div>
                ))}
            </div>

            {cart.length > 0 && !showCart && !selectedItem && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-5 animate-[slideUp_0.3s_ease-out]">
                    <div className="bg-gray-900/95 backdrop-blur-xl shadow-2xl rounded-full px-2 py-2 flex items-center justify-between w-full border border-gray-700">
                        <div className="flex items-center pl-4 cursor-pointer" onClick={() => setShowCart(true)}>
                            <div className="relative">
                                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white"><ShoppingBag size={20} /></div>
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-gray-900">{cart.length}</span>
                            </div>
                            <div className="ml-4">
                                <div className="text-xs text-gray-400 font-medium mb-0.5">目前金額</div>
                                <div className="text-xl font-bold text-white tracking-wide">${cart.reduce((s,i)=>s+i.displayPrice, 0)}</div>
                            </div>
                        </div>
                        <button onClick={() => setShowCart(true)} className={`px-8 py-3.5 rounded-full font-bold text-sm text-white transition-all shadow-lg ${shopState.isOpen ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/40 active:scale-95' : 'bg-gray-600 text-gray-300 shadow-none'}`}>去結帳</button>
                    </div>
                </div>
            )}

            {selectedItem && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end animate-[fadeIn_0.2s_ease-out]">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={()=>setSelectedItem(null)}></div>
                    <div className="relative bg-white w-full rounded-t-[32px] shadow-2xl max-h-[90vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                        <div className="sticky top-0 bg-white/95 backdrop-blur-md rounded-t-[32px] pt-4 pb-4 px-6 z-10 border-b border-gray-100 flex justify-between items-center">
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full"></div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 mt-2">{selectedItem.name}</h3>
                                <div className="text-orange-600 font-bold text-xl mt-1">${selectedItem.basePrice}</div>
                            </div>
                            <button onClick={()=>setSelectedItem(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"><X size={18} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto no-scrollbar space-y-6 flex-1">
                            {selectedItem.type === "套餐" && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><p className="text-sm font-bold text-gray-800">主食選擇 <span className="text-rose-500">*</span></p></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedItem.mainOptions.map(m => (
                                                <button key={m} onClick={()=>setSelectedItem({...selectedItem, main:m})} className={`py-4 rounded-2xl text-sm font-bold transition-all border-2 ${selectedItem.main===m?'border-orange-500 bg-orange-50 text-orange-700':'border-transparent bg-gray-50 text-gray-600'}`}>{m}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><p className="text-sm font-bold text-gray-800">湯品選擇 <span className="text-rose-500">*</span></p></div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedItem.soupOptions.map(s => (
                                                <button key={s} onClick={()=>setSelectedItem({...selectedItem, soup:s})} className={`py-4 rounded-2xl text-sm font-bold transition-all border-2 ${selectedItem.soup===s?'border-orange-500 bg-orange-50 text-orange-700':'border-transparent bg-gray-50 text-gray-600'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {showExtras && (
                                <>
                                    <div className="space-y-3">
                                        <p className="text-sm font-bold text-gray-800">辣度</p>
                                        <div className="flex gap-3">
                                            {['不辣','小辣','大辣'].map(s => (
                                                <button key={s} onClick={()=>setSelectedItem({...selectedItem, spicy:s})} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${selectedItem.spicy===s?'border-orange-500 bg-orange-50 text-orange-700':'border-transparent bg-gray-50 text-gray-500'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-sm font-bold text-gray-800">加購 (+10元)</p>
                                        <div className="flex gap-3">
                                            <button onClick={()=>{
                                                const t = selectedItem.name.includes('麵') ? '加麵' : '加飯';
                                                const h = selectedItem.addons.includes(t);
                                                setSelectedItem({...selectedItem, addons: h ? selectedItem.addons.filter(a=>a!==t) : [...selectedItem.addons, t]})
                                            }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${selectedItem.addons.includes(selectedItem.name.includes('麵')?'加麵':'加飯')?'border-gray-800 bg-gray-800 text-white':'border-transparent bg-gray-50 text-gray-600'}`}>
                                                {selectedItem.name.includes('麵') ? '加麵' : '加飯'}
                                            </button>
                                            <button onClick={()=>{
                                                const h = selectedItem.addons.includes('加菜');
                                                setSelectedItem({...selectedItem, addons: h ? selectedItem.addons.filter(a=>a!=='加菜') : [...selectedItem.addons, '加菜']})
                                            }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${selectedItem.addons.includes('加菜')?'border-gray-800 bg-gray-800 text-white':'border-transparent bg-gray-50 text-gray-600'}`}>加菜</button>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="space-y-2 pb-6">
                                <p className="text-sm font-bold text-gray-800">單品備註</p>
                                <textarea placeholder="例如：不要蔥、湯分開..." className="w-full p-4 bg-gray-50 rounded-2xl text-sm border-none outline-none focus:ring-2 focus:ring-orange-200" rows="2" value={selectedItem.itemNote || ''} onChange={e=>setSelectedItem({...selectedItem, itemNote:e.target.value})} />
                            </div>
                        </div>
                        <div className="p-5 bg-white border-t border-gray-100">
                            <button onClick={addToCart} className="w-full py-4 bg-orange-600 text-white rounded-full font-bold text-lg shadow-lg shadow-orange-600/30 active:scale-95 transition-transform flex justify-center items-center gap-2">
                                加入購物車 <span className="font-normal text-orange-200">|</span> ${(selectedItem.basePrice + ((selectedItem.addons||[]).length*10)) * selectedItem.quantity}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCart && (
                <div className="fixed inset-0 z-[60] flex flex-col justify-end animate-[fadeIn_0.2s_ease-out]">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowCart(false)}></div>
                    <div className="relative bg-gray-50 w-full rounded-t-[32px] shadow-2xl max-h-[95vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                        <div className="bg-white rounded-t-[32px] px-6 py-5 flex justify-between items-center border-b border-gray-100">
                            <h3 className="font-black text-2xl text-gray-900">結帳確認</h3>
                            <button onClick={() => setShowCart(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"><X size={18} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 flex-1">
                            <div className="bg-white rounded-[24px] p-2 shadow-sm border border-gray-100">
                                {cart.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-4 border-b border-gray-50 last:border-0">
                                        <div className="flex-1">
                                            <div className="font-bold text-base text-gray-900">{item.name} <span className="text-gray-400 text-sm ml-1">x{item.quantity}</span></div>
                                            <div className="text-xs text-gray-400 mt-1 leading-relaxed">{item.customs}</div>
                                            <div className="text-orange-600 font-bold text-sm mt-1">${item.displayPrice}</div>
                                        </div>
                                        <button onClick={() => removeFromCart(idx)} className="w-10 h-10 ml-3 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center active:bg-rose-100 transition hover:bg-rose-100"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 space-y-5">
                                <div>
                                    <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Clock size={16} /> 預定取餐時間 <span className="text-rose-500">*</span></p>
                                    <div className="flex gap-3">
                                        <input type="date" className="flex-1 p-3.5 bg-gray-50 rounded-xl text-sm font-medium border-none outline-none focus:ring-2 focus:ring-orange-200" value={pickupDate} onChange={e=>setPickupDate(e.target.value)} />
                                        <input type="time" className="flex-1 p-3.5 bg-gray-50 rounded-xl text-sm font-medium border-none outline-none focus:ring-2 focus:ring-orange-200" value={pickupTime} onChange={e=>setPickupTime(e.target.value)} />
                                    </div>
                                </div>
                                <hr className="border-gray-100" />
                                <div>
                                    <p className="text-sm font-bold text-gray-800 mb-3">整單備註</p>
                                    <textarea className="w-full p-4 bg-gray-50 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-orange-200" placeholder="例如：自備環保袋..." rows="2" value={globalNote} onChange={e=>setGlobalNote(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 pb-8 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.05)] border-t border-gray-100">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <span className="font-bold text-gray-500">總計金額</span>
                                <span className="text-3xl font-black text-orange-600">${cart.reduce((s,i)=>s+i.displayPrice, 0)}</span>
                            </div>
                            <button id="submit-btn" onClick={submitOrder} disabled={!shopState.isOpen || isUpdating} className={`w-full py-4 rounded-full font-bold text-lg text-white shadow-lg transition-transform active:scale-95 flex justify-center items-center ${shopState.isOpen ? 'bg-gray-900 shadow-gray-900/30' : 'bg-gray-300 shadow-none'}`}>
                                {isUpdating ? '處理中...' : (shopState.isOpen ? '確認送出訂單' : '目前休息中')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {adminStep > 0 && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setAdminStep(0)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-[32px] p-8 text-center space-y-6 shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <h2 className="font-black text-2xl text-gray-900">後台管理</h2>
                        {isUpdating ? (
                            <div className="py-8 space-y-4 text-orange-600 font-bold flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-gray-100 border-t-orange-600 rounded-full animate-spin"></div>
                                <p>狀態更新中...</p>
                            </div>
                        ) : adminStep === 1 ? (
                            <div className="space-y-4">
                                <input type="password" placeholder="請輸入管理密碼" className="w-full p-4 bg-gray-50 rounded-xl text-center border-none outline-none focus:ring-2 focus:ring-orange-200 text-lg tracking-widest" value={inputPwd} onChange={e=>setInputPwd(e.target.value)} />
                                <button onClick={()=>setAdminStep(2)} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-black">登入</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button onClick={()=>toggleStatus('Y')} className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-lg hover:bg-emerald-100 transition-colors">開啟營業</button>
                                <button onClick={()=>toggleStatus('N')} className="w-full py-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-lg hover:bg-rose-100 transition-colors">關閉營業</button>
                                <button onClick={() => setAdminStep(0)} className="pt-4 block w-full text-center text-gray-400 font-medium hover:text-gray-600">取消</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}