import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, Trash2, Edit2, Search, Share2, Settings, Check, X, ChevronRight, Flower2, Heart } from 'lucide-react';

// --- HOOKS DE ALMACENAMIENTO ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (key === 'shein_inventory' || key === 'shein_orders') {
          return migrateData(key, parsed);
        }
        return parsed;
      }
      return initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(storedValue));
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

function migrateData(key, data) {
  if (!Array.isArray(data)) return data;
  if (key === 'shein_inventory') {
    return data.map(item => ({ ...item, currency: item.currency || 'GTQ' }));
  }
  if (key === 'shein_orders') {
    return data.map(order => ({
      ...order,
      abonos: order.abonos || [],
      items: (order.items || []).map(item => ({
        ...item,
        currency: item.currency || 'GTQ',
        qty: item.qty || 1
      }))
    }));
  }
  return data;
}

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- COMPONENTES DECORATIVOS ---
const MascotRose = ({ size = 60, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 15C25 5 5 30 15 50C5 70 25 95 50 85C75 95 95 70 85 50C95 30 75 5 50 15Z" fill="#FBCFE8"/>
    <path d="M50 30C35 20 20 35 30 50C20 65 35 80 50 70C65 80 80 65 70 50C80 35 65 20 50 30Z" fill="#F472B6"/>
    <circle cx="38" cy="45" r="5" fill="#831843"/>
    <circle cx="62" cy="45" r="5" fill="#831843"/>
    <circle cx="34" cy="52" r="4" fill="#FDA4AF" opacity="0.6"/>
    <circle cx="66" cy="52" r="4" fill="#FDA4AF" opacity="0.6"/>
    <path d="M45 56 Q50 63 55 56" stroke="#831843" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

const MascotToast = ({ visible, message }) => (
  <div className={`fixed top-20 left-0 right-0 mx-auto w-max max-w-[90%] z-[200] transition-all duration-500 ease-out transform ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'}`}>
    <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-[2rem] shadow-[0_15px_40px_-10px_rgba(225,29,72,0.3)] border-2 border-[#FBCFE8] flex items-center gap-3">
      <MascotRose size={36} className="animate-bounce" />
      <span className="font-black text-[#9F1239] text-[15px] leading-tight">{message}</span>
    </div>
  </div>
);

// NUEVO: Modal de Confirmación seguro para iOS
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#831843]/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border-2 border-[#FBCFE8] animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-[#FFF1F2] rounded-full flex items-center justify-center mx-auto mb-4 text-[#E11D48]">
          <Trash2 size={32} />
        </div>
        <h3 className="text-xl font-black text-[#9F1239] mb-2">{title}</h3>
        <p className="text-[#FB7185] mb-6 font-bold">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-[#FFF0F5] text-[#9F1239] py-3 rounded-2xl font-black active:scale-95">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-[#E11D48] text-white py-3 rounded-2xl font-black active:scale-95 shadow-md">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [activeCurrency, setActiveCurrency] = useLocalStorage('shein_active_currency', 'GTQ');
  const [exchangeRate, setExchangeRate] = useLocalStorage('shein_exchange_rate', 0.38);
  
  const [inventory, setInventory] = useLocalStorage('shein_inventory', []);
  const [clients, setClients] = useLocalStorage('shein_clients', []);
  const [orders, setOrders] = useLocalStorage('shein_orders', []);

  const [toast, setToast] = useState({ visible: false, message: '' });

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    const numAmount = parseFloat(amount) || 0;
    if (fromCurrency === 'MXN' && toCurrency === 'GTQ') return numAmount * exchangeRate;
    if (fromCurrency === 'GTQ' && toCurrency === 'MXN') return numAmount / exchangeRate;
    return numAmount;
  };

  const formatMoney = (amount, currency = activeCurrency) => {
    const numAmount = parseFloat(amount) || 0;
    const symbol = currency === 'GTQ' ? 'Q' : '$';
    const suffix = currency === 'MXN' ? ' MXN' : '';
    return `${symbol} ${numAmount.toFixed(2)}${suffix}`;
  };

  const calcTotal = (order) => {
    let total = 0;
    let paid = 0;
    (order.items || []).forEach(item => {
      const qty = item.qty || 1;
      const convertedPrice = convertAmount(item.price, item.currency, activeCurrency) * qty;
      total += convertedPrice;
      if (item.status === 'paid') paid += convertedPrice;
    });
    
    (order.abonos || []).forEach(abono => {
      paid += convertAmount(abono.amount, abono.currency, activeCurrency);
    });

    total = Math.round(total * 100) / 100;
    paid = Math.round(paid * 100) / 100;
    return { total, paid, pending: Math.round((total - paid) * 100) / 100 };
  };

  const motivationalPhrases = [
    "¡Tú puedes! 🌸",
    "¡Qué bonitas prendas! 👗",
    "¡A vender mucho hoy! 💖",
    "¡Eres la mejor! ✨",
    "¡Todo se ve hermoso! 🎀",
    "¡Excelente trabajo! 🌟"
  ];

  return (
    <div className="fixed inset-0 bg-[#FFF0F5] text-[#831843] font-sans flex flex-col overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23be123c\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

      <MascotToast visible={toast.visible} message={toast.message} />

      <header className="h-16 shrink-0 bg-[#FFE4E6]/95 backdrop-blur-sm border-b border-[#FECDD3] px-4 flex justify-between items-center shadow-sm relative z-30">
        <div 
          className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" 
          onClick={() => showToast(motivationalPhrases[Math.floor(Math.random() * motivationalPhrases.length)])}
        >
          <MascotRose size={34} className="hover:rotate-12 transition-transform" />
          <h1 className="text-xl font-black text-[#9F1239] tracking-tight">Ventas</h1>
        </div>
        <div className="flex bg-white/60 rounded-full p-1 border border-[#FECDD3] shadow-sm backdrop-blur-sm">
          <button 
            onClick={() => setActiveCurrency('MXN')}
            className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${activeCurrency === 'MXN' ? 'bg-[#FDA4AF] text-white shadow-sm' : 'text-[#FB7185] hover:bg-white'}`}
          >
            MXN
          </button>
          <button 
            onClick={() => setActiveCurrency('GTQ')}
            className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${activeCurrency === 'GTQ' ? 'bg-[#86EFAC] text-[#065F46] shadow-sm' : 'text-[#FB7185] hover:bg-white'}`}
          >
            GTQ
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full">
        <div className="p-4 max-w-2xl mx-auto pb-28">
          {activeTab === 'orders' && (
            <OrdersView 
              orders={orders} setOrders={setOrders} 
              clients={clients} inventory={inventory}
              formatMoney={formatMoney} calcTotal={calcTotal} activeCurrency={activeCurrency}
              showToast={showToast}
            />
          )}
          {activeTab === 'clients' && <ClientsView clients={clients} setClients={setClients} showToast={showToast} />}
          {activeTab === 'inventory' && (
            <InventoryView 
              inventory={inventory} setInventory={setInventory} 
              formatMoney={formatMoney} convertAmount={convertAmount} activeCurrency={activeCurrency}
              showToast={showToast}
            />
          )}
          {activeTab === 'settings' && <SettingsView exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} showToast={showToast} />}
        </div>
      </main>

      <nav className="shrink-0 bg-white/95 backdrop-blur-md border-t border-[#FECDD3] flex justify-around p-3 pb-safe relative z-40 shadow-[0_-4px_15px_-3px_rgba(251,113,133,0.15)]">
        <NavBtn icon={<ChevronRight />} label="Pedidos" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
        <NavBtn icon={<Search />} label="Clientas" active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} />
        <NavBtn icon={<Plus />} label="Inversión" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
        <NavBtn icon={<Settings />} label="Ajustes" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>
    </div>
  );
}

const NavBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center p-2 rounded-2xl transition-all duration-300 w-16 ${active ? 'text-[#BE123C] bg-[#FFE4E6] scale-110 shadow-sm' : 'text-[#FDA4AF] hover:bg-[#FFF0F5]'}`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] mt-1 font-bold">{label}</span>
  </button>
);

// --- VISTA DE PEDIDOS ---
function OrdersView({ orders, setOrders, clients, inventory, formatMoney, calcTotal, activeCurrency, showToast }) {
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  
  const [orderToDelete, setOrderToDelete] = useState(null);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleUpdateItemStatus = (orderId, itemId, newStatus) => {
    let orderToUpdate = orders.find(o => o.id === orderId);
    let updatedItems = (orderToUpdate.items || []).map(i => i.id === itemId ? { ...i, status: newStatus } : i);
    
    setOrders(orders.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, items: updatedItems };
    }));
    
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => ({ ...prev, items: updatedItems }));
    }

    if (newStatus === 'paid') {
      const isAllPaidNow = updatedItems.every(i => i.status === 'paid');
      const hasPending = calcTotal({...orderToUpdate, items: updatedItems}).pending;
      if (isAllPaidNow || hasPending <= 0) {
         showToast("¡Cuenta saldada! 💸");
      } else {
         showToast("¡Pagado! ✅");
      }
    }
  };

  const handleAddAbono = (orderId, abono) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, abonos: [...(o.abonos || []), abono] } : o);
    setOrders(updated);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(updated.find(o => o.id === orderId));
    }
    showToast("¡Abono registrado! 💰");
  };

  const handleDeleteAbono = (orderId, abonoId) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, abonos: (o.abonos || []).filter(a => a.id !== abonoId) } : o);
    setOrders(updated);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(updated.find(o => o.id === orderId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-4 text-[#FB7185]" size={20} />
        <input 
          type="text" placeholder="Buscar clienta..." 
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-3xl border-2 border-transparent bg-white shadow-sm focus:border-[#FBCFE8] focus:ring-4 focus:ring-[#FBCFE8]/50 outline-none transition-all text-[#831843] font-medium placeholder-[#FB7185]"
        />
      </div>

      <button 
        onClick={() => setIsEditingOrder(true)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#F472B6] to-[#FB7185] text-white p-4 rounded-3xl font-black text-lg shadow-md active:scale-95 transition-all"
      >
        <Flower2 size={24} /> Crear Nuevo Pedido
      </button>

      {orders.length === 0 && !search && (
        <div className="flex flex-col items-center justify-center py-12 opacity-80">
          <MascotRose size={110} className="mb-4" />
          <p className="font-black text-[#BE123C] text-xl text-center">¡Todo listo para empezar!</p>
          <p className="text-[#FB7185] text-sm text-center mt-1 font-bold">Crea tu primer pedido arriba 👆</p>
        </div>
      )}

      {filteredClients.map(client => {
        const clientOrders = orders.filter(o => o.clientId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (clientOrders.length === 0) return null;

        return (
          <div key={client.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-[2rem] shadow-sm border border-[#FBCFE8]">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={20} className="text-[#F472B6] fill-[#FBCFE8]" />
              <h2 className="text-xl font-black text-[#9F1239]">{client.name}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {clientOrders.map(order => {
                const { pending, total } = calcTotal(order);
                const isPaid = pending <= 0;
                return (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 rounded-3xl cursor-pointer transition-all active:scale-95 border-2 flex flex-col justify-between ${isPaid ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-[#FFF1F2] border-[#FECDD3]'}`}
                  >
                    <div>
                      <p className="text-xs text-[#9F1239]/60 mb-1 font-bold">{order.date}</p>
                      <p className={`text-xl font-black leading-tight ${isPaid ? 'text-[#059669]' : 'text-[#E11D48]'}`}>
                        {isPaid ? 'Saldado' : formatMoney(pending)}
                      </p>
                    </div>
                    <p className={`text-xs mt-2 font-bold ${isPaid ? 'text-[#059669]/60' : 'text-[#E11D48]/60'}`}>Total: {formatMoney(total)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedOrder && !isEditingOrder && (
        <OrderDetailModal 
          order={selectedOrder} 
          client={clients.find(c => c.id === selectedOrder.clientId)}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateItemStatus}
          onAddAbono={handleAddAbono}
          onDeleteAbono={handleDeleteAbono}
          formatMoney={formatMoney}
          calcTotal={calcTotal}
          activeCurrency={activeCurrency}
          showToast={showToast}
          onEdit={() => setIsEditingOrder(selectedOrder)}
          onDelete={() => setOrderToDelete(selectedOrder)}
        />
      )}

      {isEditingOrder && (
        <OrderFormModal 
          order={typeof isEditingOrder === 'object' ? isEditingOrder : null}
          clients={clients} inventory={inventory}
          onClose={() => setIsEditingOrder(false)}
          onSave={(newOrder) => {
            if(typeof isEditingOrder === 'object') {
              newOrder.abonos = newOrder.abonos || (typeof isEditingOrder === 'object' ? isEditingOrder.abonos : []);
              setOrders(orders.map(o => o.id === newOrder.id ? newOrder : o));
              setSelectedOrder(newOrder);
              showToast("¡Pedido actualizado! ✏️");
            } else {
              setOrders([...orders, newOrder]);
              showToast("¡Pedido guardado! 🎉");
            }
            setIsEditingOrder(false);
          }}
          activeCurrency={activeCurrency}
          showToast={showToast}
        />
      )}

      <ConfirmModal 
        isOpen={!!orderToDelete}
        title="¿Eliminar pedido?"
        message="Se borrará toda la cuenta y los abonos de este pedido de forma permanente."
        onCancel={() => setOrderToDelete(null)}
        onConfirm={() => {
          setOrders(orders.filter(o => o.id !== orderToDelete.id));
          setOrderToDelete(null);
          setSelectedOrder(null);
          showToast("Pedido eliminado 🗑️");
        }}
      />
    </div>
  );
}

// --- MODAL DETALLE DE PEDIDO ---
function OrderDetailModal({ order, client, onClose, onUpdateStatus, onAddAbono, onDeleteAbono, formatMoney, calcTotal, activeCurrency, onEdit, onDelete, showToast }) {
  const { total, paid, pending } = calcTotal(order);
  const isSaldado = pending <= 0;

  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoCurrency, setAbonoCurrency] = useState(activeCurrency);

  const handleAddAbonoClick = () => {
    const amt = parseFloat(abonoAmount);
    if (!amt || amt <= 0) return;
    onAddAbono(order.id, { id: generateId(), amount: amt, currency: abonoCurrency, date: new Date().toLocaleDateString() });
    setAbonoAmount('');
  };

  const generateMessage = () => {
    let msg = `Hola ${client?.name || ''} 🌸, te comparto el estado de tu cuenta (Pedido del ${order.date}):\n\n`;
    const pendingItems = (order.items || []).filter(i => i.status === 'pending');
    const paidItems = (order.items || []).filter(i => i.status === 'paid');

    if (pendingItems.length > 0) {
      msg += `🛍️ *Pendiente:*\n`;
      pendingItems.forEach(i => {
        const sizeText = i.size ? ` (${i.size})` : '';
        msg += `- ${i.qty > 1 ? i.qty + 'x ' : ''}${i.desc}${sizeText}: ${formatMoney(i.price * (i.qty || 1), i.currency)}\n`;
      });
    }
    if (paidItems.length > 0) {
      msg += `\n✅ *Pagado:*\n`;
      paidItems.forEach(i => {
        const sizeText = i.size ? ` (${i.size})` : '';
        msg += `- ${i.qty > 1 ? i.qty + 'x ' : ''}${i.desc}${sizeText}: ${formatMoney(i.price * (i.qty || 1), i.currency)}\n`;
      });
    }

    if (order.abonos && order.abonos.length > 0) {
      msg += `\n💝 *Abonos:*\n`;
      order.abonos.forEach(a => msg += `- ${formatMoney(a.amount, a.currency)}\n`);
    }

    msg += `\n--- Resumen en ${activeCurrency} ---\n`;
    msg += `Total: ${formatMoney(total)}\n`;
    msg += `Abonado: ${formatMoney(paid)}\n`;
    msg += `*Saldo Pendiente: ${formatMoney(pending)}*`;
    return msg;
  };

  const shareWhatsApp = () => {
    showToast("¡Abriendo WhatsApp! 📱");
    window.open(`https://wa.me/?text=${encodeURIComponent(generateMessage())}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-[#831843]/40 backdrop-blur-sm z-[100] flex flex-col">
      {/* ESPACIO SUPERIOR PARA HACER CLICK Y CERRAR */}
      <div className="flex-1" onClick={onClose}></div>
      
      {/* CONTENEDOR MODAL */}
      <div className="bg-[#FFF0F5] w-full h-[90vh] rounded-t-[2.5rem] flex flex-col shadow-2xl border-t border-[#FBCFE8]">
        
        {/* Cabecera Fija */}
        <div className="p-6 border-b border-[#FBCFE8] flex justify-between items-center bg-white shrink-0 rounded-t-[2.5rem]">
          <div>
            <h3 className="text-2xl font-black text-[#9F1239] flex items-center gap-2">
              <Flower2 size={24} className="text-[#F472B6]" />
              {client?.name}
            </h3>
            <p className="text-sm text-[#FB7185] font-bold mt-1">{order.date}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-[#FFF1F2] text-[#E11D48] rounded-full active:scale-90"><X size={24} strokeWidth={3}/></button>
        </div>
        
        {/* Contenido Scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 w-full max-w-2xl mx-auto">
          <div className={`p-6 rounded-[2rem] text-center shadow-inner relative overflow-hidden ${isSaldado ? 'bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] text-[#065F46]' : 'bg-gradient-to-br from-[#FFE4E6] to-[#FECDD3] text-[#BE123C]'}`}>
            <p className="text-sm font-black uppercase tracking-widest opacity-80">{isSaldado ? 'Cuenta Saldada' : 'Saldo Pendiente'}</p>
            <p className="text-5xl font-black mt-2 tracking-tight">{formatMoney(pending)}</p>
            <p className="text-sm mt-3 font-bold opacity-70">Total: {formatMoney(total)} • Abonado: {formatMoney(paid)}</p>
            {isSaldado && <MascotRose size={80} className="absolute -right-4 -bottom-4 opacity-20" />}
          </div>

          <div className="space-y-3">
            <h4 className="font-black text-[#9F1239] flex items-center gap-2"><Heart size={18}/> Prendas del pedido</h4>
            {(order.items || []).map(item => (
              <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-[#FBCFE8] flex items-center gap-3">
                {item.image ? (
                  <img src={item.image} alt="prod" className="w-16 h-16 object-cover rounded-2xl shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-[#FFF1F2] rounded-2xl flex items-center justify-center"><Camera size={24} className="text-[#FDA4AF]"/></div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-[#831843] leading-tight">
                    {item.qty > 1 && <span className="text-[#F472B6] mr-1">{item.qty}x</span>}
                    {item.desc}
                  </p>
                  {item.size && <p className="text-xs text-[#FB7185] font-bold mt-0.5">{item.size}</p>}
                  <p className="text-sm font-black text-[#E11D48] mt-1">
                    {formatMoney(item.price * (item.qty || 1), item.currency)}
                    {item.qty > 1 && <span className="text-[10px] text-[#FDA4AF] font-bold ml-1">({formatMoney(item.price, item.currency)} c/u)</span>}
                  </p>
                </div>
                <button 
                  onClick={() => onUpdateStatus(order.id, item.id, item.status === 'paid' ? 'pending' : 'paid')}
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md shrink-0 ${item.status === 'paid' ? 'bg-[#34D399] text-white' : 'bg-[#FFF1F2] text-[#FDA4AF] border-2 border-[#FECDD3]'}`}
                >
                  <Check size={28} strokeWidth={4} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-6 mt-6 border-t-2 border-dashed border-[#FBCFE8]">
            <h4 className="font-black text-[#9F1239]">Abonos (Pagos extra)</h4>
            
            {order.abonos && order.abonos.map(abono => (
              <div key={abono.id} className="flex justify-between items-center bg-white p-4 rounded-3xl border border-[#A7F3D0] shadow-sm">
                <p className="font-bold text-[#059669] flex items-center gap-2"><Check size={16}/> Abono</p>
                <div className="flex items-center gap-3">
                  <p className="font-black text-[#059669] text-lg">{formatMoney(abono.amount, abono.currency)}</p>
                  <button onClick={() => onDeleteAbono(order.id, abono.id)} className="p-2 text-[#E11D48] bg-[#FFF1F2] rounded-full active:scale-90"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
            
            <div className="flex gap-2 bg-white p-2 rounded-3xl border-2 border-[#FBCFE8] focus-within:border-[#F472B6] shadow-sm items-center">
              <select value={abonoCurrency} onChange={e => setAbonoCurrency(e.target.value)} className="bg-[#FFF1F2] p-3 rounded-2xl text-sm font-black text-[#BE123C] outline-none">
                <option value="GTQ">Q</option>
                <option value="MXN">$</option>
              </select>
              <input type="number" placeholder="Monto abonado" value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} className="flex-1 px-3 outline-none w-full bg-transparent font-black text-[#831843] placeholder-[#FDA4AF]" />
              <button onClick={handleAddAbonoClick} className="bg-[#34D399] text-white px-5 py-3 rounded-2xl font-black active:scale-95 shadow-md">Agregar</button>
            </div>
          </div>
        </div>

        {/* Footer Fijo */}
        <div className="p-4 bg-white border-t border-[#FBCFE8] shrink-0 pb-8 z-20 shadow-[0_-4px_15px_-3px_rgba(251,113,133,0.1)]">
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3">
            <button onClick={shareWhatsApp} className="col-span-2 flex items-center justify-center gap-2 bg-[#10B981] text-white p-4 rounded-3xl font-black active:scale-95 shadow-md">
              <Share2 size={24} /> Compartir por WhatsApp
            </button>
            <button onClick={onEdit} className="flex items-center justify-center gap-2 bg-[#FBCFE8] text-[#9F1239] p-4 rounded-3xl font-black active:scale-95">
              <Edit2 size={20} /> Editar
            </button>
            <button onClick={onDelete} className="flex items-center justify-center gap-2 bg-[#FFF1F2] text-[#E11D48] p-4 rounded-3xl font-black active:scale-95 border border-[#FECDD3]">
              <Trash2 size={20} /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODAL FORMULARIO DE PEDIDO ---
function OrderFormModal({ order, clients, inventory, onClose, onSave, activeCurrency, showToast }) {
  const [clientId, setClientId] = useState(order ? order.clientId : (clients[0]?.id || ''));
  const [date, setDate] = useState(order ? order.date : new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState(order ? order.items : []);
  
  const [newItem, setNewItem] = useState({ desc: '', size: '', price: '', currency: activeCurrency, image: null, status: 'pending', qty: 1 });

  const handleAddItemManual = () => {
    if (!newItem.desc || !newItem.price) return alert('Descripción y precio obligatorios');
    
    const existingIndex = items.findIndex(i => 
      i.desc.trim().toLowerCase() === newItem.desc.trim().toLowerCase() && 
      (i.size || '').trim().toLowerCase() === (newItem.size || '').trim().toLowerCase() &&
      i.price === parseFloat(newItem.price) &&
      i.currency === newItem.currency
    );

    if (existingIndex >= 0) {
      const updatedItems = [...items];
      updatedItems[existingIndex].qty = (updatedItems[existingIndex].qty || 1) + newItem.qty;
      setItems(updatedItems);
    } else {
      setItems([...items, { ...newItem, id: generateId(), price: parseFloat(newItem.price) }]);
    }
    
    showToast("¡Prenda sumada a la cuenta! 🛍️");
    setNewItem({ desc: '', size: '', price: '', currency: activeCurrency, image: null, status: 'pending', qty: 1 });
  };

  const handleAddFromInventory = (invItem) => {
    setNewItem({
      desc: invItem.desc,
      size: invItem.size || '',
      price: invItem.price.toString(),
      currency: invItem.currency,
      image: invItem.image,
      status: 'pending',
      qty: 1
    });
  };

  const updateItemQty = (id, delta) => {
    setItems(items.map(i => {
      if (i.id === id) {
        return { ...i, qty: Math.max(1, (i.qty || 1) + delta) };
      }
      return i;
    }));
  };

  const handleSave = () => {
    if (!clientId) return alert('Selecciona un cliente');
    if (items.length === 0) return alert('Agrega al menos un producto');
    onSave({ id: order ? order.id : generateId(), clientId, date, items, abonos: order ? order.abonos : [] });
  };

  return (
    <div className="fixed inset-0 bg-[#FFF0F5] z-[100] flex flex-col">
      {/* Cabecera Fija */}
      <div className="p-4 flex items-center justify-between border-b border-[#FBCFE8] bg-white/95 backdrop-blur-md shadow-sm shrink-0 z-20">
        <div className="max-w-2xl mx-auto w-full flex justify-between items-center">
          <h2 className="text-2xl font-black text-[#9F1239] flex items-center gap-2">
            <Flower2 size={24} className="text-[#F472B6]" />
            {order ? 'Editar Pedido' : 'Nuevo Pedido'}
          </h2>
          <button onClick={onClose} className="p-2 bg-[#FFF1F2] text-[#E11D48] rounded-full active:scale-95"><X size={24} strokeWidth={3}/></button>
        </div>
      </div>
      
      {/* Zona de Scroll Exclusiva */}
      <div className="flex-1 overflow-y-auto w-full bg-[#FFF0F5]">
        <div className="p-4 space-y-6 max-w-2xl mx-auto pb-8 pt-4">
          <div className="space-y-3 bg-white p-5 rounded-[2rem] shadow-sm border border-[#FBCFE8]">
            <label className="block font-black text-[#9F1239]">Clienta</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full p-4 rounded-2xl bg-[#FFF0F5] border-2 border-[#FECDD3] focus:border-[#F472B6] outline-none font-bold text-[#831843]">
              <option value="">Seleccionar...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-4 rounded-2xl bg-[#FFF0F5] border-2 border-[#FECDD3] outline-none font-bold text-[#831843]" />
          </div>

          <div className="bg-white border-2 border-[#FBCFE8] p-5 rounded-[2rem] space-y-4 shadow-sm">
            <h4 className="font-black text-[#9F1239] flex items-center gap-2"><Heart size={18}/> Prenda a agregar</h4>
            <div className="grid grid-cols-4 gap-3">
              <input type="text" placeholder="¿Qué prenda es?" value={newItem.desc} onChange={e => setNewItem({...newItem, desc: e.target.value})} className="col-span-4 p-4 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
              <input type="text" placeholder="Detalle/Talla" value={newItem.size} onChange={e => setNewItem({...newItem, size: e.target.value})} className="col-span-2 p-4 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
              <div className="col-span-2 flex items-center bg-[#FFF0F5] rounded-2xl border-2 border-transparent focus-within:border-[#F472B6] overflow-hidden">
                 <span className="pl-4 text-[#FB7185] font-black">Cant:</span>
                 <input type="number" min="1" value={newItem.qty || ''} onChange={e => setNewItem({...newItem, qty: parseInt(e.target.value) || 1})} className="w-full p-4 outline-none text-center bg-transparent font-black text-[#831843]" />
              </div>
              <div className="col-span-4 flex bg-[#FFF0F5] rounded-2xl border-2 border-transparent focus-within:border-[#F472B6] overflow-hidden">
                 <select value={newItem.currency} onChange={e => setNewItem({...newItem, currency: e.target.value})} className="bg-[#FFE4E6] pl-4 pr-2 border-r-2 border-[#FECDD3] text-sm outline-none font-black text-[#BE123C]">
                   <option value="GTQ">Q</option>
                   <option value="MXN">$</option>
                 </select>
                 <input type="number" placeholder="Precio Unitario" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full p-4 outline-none bg-transparent font-black text-[#831843] placeholder-[#FB7185]" />
              </div>
            </div>
            <button onClick={handleAddItemManual} className="w-full p-4 rounded-2xl bg-[#F472B6] text-white font-black active:scale-95 transition-transform shadow-md mt-2">
              Sumar a la cuenta
            </button>
          </div>

          {inventory.length > 0 && (
            <div>
              <h4 className="font-black text-[#9F1239] mb-3 ml-2">🌸 Toca una prenda de tu inventario:</h4>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x px-2">
                {inventory.map(inv => (
                  <div key={inv.id} onClick={() => handleAddFromInventory(inv)} className="snap-start shrink-0 w-32 bg-white rounded-3xl border border-[#FBCFE8] p-3 flex flex-col items-center cursor-pointer active:scale-95 shadow-sm">
                     {inv.image ? <img src={inv.image} className="w-full h-24 object-cover rounded-2xl mb-2 shadow-inner"/> : <div className="w-full h-24 bg-[#FFF1F2] rounded-2xl mb-2 flex items-center justify-center"><Camera className="text-[#FDA4AF]"/></div>}
                     <p className="text-xs font-black truncate w-full text-center text-[#831843]">{inv.desc}</p>
                     <p className="text-xs text-[#E11D48] font-bold mt-1">{inv.currency} {inv.price}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-black text-[#9F1239] mb-3 ml-2">Prendas en esta cuenta ({items.length})</h4>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-[2rem] border border-[#FBCFE8] shadow-sm gap-3">
                  <div className="flex-1 pr-2">
                    <p className="font-black text-[#831843] leading-tight">
                      {item.desc} 
                      {item.size && <span className="text-[#FB7185] font-bold text-sm ml-1">({item.size})</span>}
                    </p>
                    <p className="text-sm font-bold text-[#E11D48] mt-1">{item.currency} {item.price} c/u</p>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                    <div className="flex items-center bg-[#FFF1F2] rounded-2xl border border-[#FECDD3]">
                      <button onClick={() => updateItemQty(item.id, -1)} className="px-4 py-2 font-black text-[#BE123C] active:bg-[#FFE4E6] rounded-l-2xl">-</button>
                      <span className="font-black text-sm w-6 text-center text-[#831843]">{item.qty || 1}</span>
                      <button onClick={() => updateItemQty(item.id, 1)} className="px-4 py-2 font-black text-[#BE123C] active:bg-[#FFE4E6] rounded-r-2xl">+</button>
                    </div>
                    <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="p-3 text-[#E11D48] bg-[#FFF1F2] rounded-2xl"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                 <div className="text-center p-6 border-2 border-dashed border-[#FBCFE8] rounded-[2rem]">
                   <p className="font-bold text-[#FB7185]">Aún no has agregado prendas.</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pie Fijo con padding extra para evitar la barra del iPhone */}
      <div className="p-4 bg-white border-t border-[#FBCFE8] shrink-0 pb-8 z-20 shadow-[0_-4px_15px_-3px_rgba(251,113,133,0.1)]">
        <div className="max-w-2xl mx-auto w-full">
          <button onClick={handleSave} className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-[#10B981] to-[#34D399] text-white font-black text-xl active:scale-95 shadow-lg shadow-[#34D399]/30">
            Guardar Pedido Completo
          </button>
        </div>
      </div>
    </div>
  );
}

// --- VISTA CLIENTES ---
function ClientsView({ clients, setClients, showToast }) {
  const [form, setForm] = useState({ id: null, name: '', phone: '' });
  const [clientToDelete, setClientToDelete] = useState(null);

  const handleSave = () => {
    if (!form.name) return alert('El nombre es obligatorio');
    if (form.id) {
      setClients(clients.map(c => c.id === form.id ? form : c));
      showToast("¡Clienta actualizada! ✏️");
    } else {
      setClients([...clients, { ...form, id: generateId() }]);
      showToast("¡Clienta guardada! 💖");
    }
    setForm({ id: null, name: '', phone: '' });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#FBCFE8]">
        <h3 className="font-black text-xl text-[#9F1239] mb-5 flex items-center gap-2">
          <Heart size={20} className="text-[#F472B6]"/> 
          {form.id ? 'Editar Clienta' : 'Nueva Clienta'}
        </h3>
        <input type="text" placeholder="Nombre completo" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-4 mb-4 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
        <input type="tel" placeholder="Teléfono (Opcional)" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full p-4 mb-5 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
        <div className="flex gap-3">
           <button onClick={handleSave} className="flex-1 bg-[#F472B6] text-white py-4 rounded-2xl font-black active:scale-95 shadow-md">Guardar</button>
           {form.id && <button onClick={() => setForm({id:null, name:'', phone:''})} className="px-6 bg-[#FFF1F2] text-[#E11D48] rounded-2xl font-black">Cancelar</button>}
        </div>
      </div>

      <div className="space-y-3">
        {clients.map(c => (
          <div key={c.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-[#FBCFE8] flex justify-between items-center">
            <div>
              <p className="font-black text-lg text-[#831843]">{c.name}</p>
              {c.phone && <p className="text-[#FB7185] text-sm mt-0.5 font-bold">{c.phone}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setForm(c)} className="p-3 bg-[#FBCFE8] text-[#9F1239] rounded-2xl active:scale-90"><Edit2 size={20}/></button>
              <button onClick={() => setClientToDelete(c)} className="p-3 bg-[#FFF1F2] text-[#E11D48] rounded-2xl active:scale-90 border border-[#FECDD3]"><Trash2 size={20}/></button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="text-center py-10 opacity-70 cursor-pointer" onClick={() => showToast("¡Agrega a tus clientas aquí!")}>
            <MascotRose size={80} className="mb-4 mx-auto hover:scale-110 transition-transform" />
            <p className="font-bold text-[#BE123C]">Aún no tienes clientas.</p>
          </div>
        )}
      </div>
      
      <ConfirmModal 
        isOpen={!!clientToDelete}
        title="¿Eliminar clienta?"
        message="Esta clienta se borrará de tu libreta de contactos."
        onCancel={() => setClientToDelete(null)}
        onConfirm={() => {
          setClients(clients.filter(x => x.id !== clientToDelete.id));
          setClientToDelete(null);
          showToast("Clienta eliminada 🗑️");
        }}
      />
    </div>
  );
}

// --- VISTA INVENTARIO ---
function InventoryView({ inventory, setInventory, formatMoney, activeCurrency, showToast }) {
  const [form, setForm] = useState({ id: null, desc: '', size: '', price: '', currency: activeCurrency, image: null });
  const [invToDelete, setInvToDelete] = useState(null);
  const fileInputRef = useRef(null);

  const handleImage = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const compressed = await compressImage(e.target.files[0]);
      setForm({ ...form, image: compressed });
    }
  };

  const handleSave = () => {
    if (!form.desc || !form.price) return alert('Descripción y precio requeridos');
    const itemData = { ...form, price: parseFloat(form.price) };
    if (form.id) {
      setInventory(inventory.map(i => i.id === form.id ? itemData : i));
      showToast("¡Prenda actualizada! ✨");
    } else {
      setInventory([...inventory, { ...itemData, id: generateId() }]);
      showToast("¡Prenda guardada en inventario! 👗");
    }
    setForm({ id: null, desc: '', size: '', price: '', currency: activeCurrency, image: null });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#FBCFE8] space-y-5">
        <h3 className="font-black text-xl text-[#9F1239] flex items-center gap-2">
          <Flower2 size={20} className="text-[#F472B6]"/> 
          {form.id ? 'Editar Prenda' : 'Nueva Prenda (Inversión)'}
        </h3>
        
        <div className="flex gap-4 items-start">
          <div onClick={() => fileInputRef.current.click()} className="w-28 h-28 shrink-0 bg-[#FFF0F5] rounded-3xl border-2 border-dashed border-[#FBCFE8] flex flex-col items-center justify-center cursor-pointer overflow-hidden text-[#FDA4AF] active:bg-[#FFE4E6] hover:border-[#F472B6] transition-colors">
            {form.image ? <img src={form.image} alt="preview" className="w-full h-full object-cover" /> : <><Camera size={28}/><span className="text-xs font-bold mt-2">Foto</span></>}
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImage} className="hidden" />
          
          <div className="flex-1 space-y-3">
            <input type="text" placeholder="Descripción" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} className="w-full p-4 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
            <div className="flex gap-2">
              <input type="text" placeholder="Detalle" value={form.size} onChange={e => setForm({...form, size: e.target.value})} className="w-1/3 p-4 rounded-2xl bg-[#FFF0F5] border-2 border-transparent focus:border-[#F472B6] outline-none font-bold text-[#831843] placeholder-[#FB7185]" />
              <div className="flex flex-1 bg-[#FFF0F5] rounded-2xl border-2 border-transparent focus-within:border-[#F472B6] overflow-hidden">
                 <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="bg-[#FFE4E6] px-3 border-r-2 border-[#FECDD3] outline-none font-black text-[#BE123C]">
                   <option value="GTQ">Q</option>
                   <option value="MXN">$</option>
                 </select>
                 <input type="number" placeholder="Costo" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full p-4 outline-none bg-transparent font-black text-[#831843] placeholder-[#FB7185]" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 pt-2">
           <button onClick={handleSave} className="flex-1 bg-[#F472B6] text-white py-4 rounded-2xl font-black active:scale-95 shadow-md">Guardar Inversión</button>
           {form.id && <button onClick={() => setForm({id:null, desc:'', size:'', price:'', currency:activeCurrency, image:null})} className="px-6 bg-[#FFF1F2] text-[#E11D48] rounded-2xl font-black">Cancelar</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {inventory.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-[#FBCFE8] flex flex-col">
            {item.image ? (
               <img src={item.image} alt={item.desc} className="w-full h-36 object-cover rounded-[1.5rem] mb-3 shadow-inner" />
            ) : (
               <div className="w-full h-36 bg-[#FFF0F5] rounded-[1.5rem] mb-3 flex items-center justify-center"><Camera className="text-[#FDA4AF]" size={32}/></div>
            )}
            <p className="font-black leading-tight flex-1 text-[#831843]">{item.desc}</p>
            {item.size && <p className="text-xs text-[#FB7185] font-bold my-1">{item.size}</p>}
            <p className="font-black text-[#E11D48] text-lg mb-3 mt-1">{formatMoney(item.price, item.currency)}</p>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => setForm(item)} className="flex-1 p-3 bg-[#FBCFE8] text-[#9F1239] rounded-2xl active:scale-95 flex justify-center"><Edit2 size={18}/></button>
              <button onClick={() => setInvToDelete(item)} className="flex-1 p-3 bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] rounded-2xl active:scale-95 flex justify-center"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
      
      {inventory.length === 0 && (
          <div className="text-center py-10 opacity-70 cursor-pointer" onClick={() => showToast("¡Aquí verás lo que compres para vender!")}>
            <MascotRose size={80} className="mb-4 mx-auto hover:scale-110 transition-transform" />
            <p className="font-bold text-[#BE123C]">Tu inventario está vacío.</p>
          </div>
      )}

      <ConfirmModal 
        isOpen={!!invToDelete}
        title="¿Eliminar prenda?"
        message="Se borrará de tu inventario permanentemente."
        onCancel={() => setInvToDelete(null)}
        onConfirm={() => {
          setInventory(inventory.filter(i => i.id !== invToDelete.id));
          setInvToDelete(null);
          showToast("Prenda borrada 🗑️");
        }}
      />
    </div>
  );
}

// --- VISTA AJUSTES (TIPO DE CAMBIO) ---
function SettingsView({ exchangeRate, setExchangeRate, showToast }) {
  const [localRate, setLocalRate] = useState(exchangeRate);
  const [loading, setLoading] = useState(false);

  const fetchApiRate = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/MXN");
      const data = await res.json();
      if (data && data.rates && data.rates.GTQ) {
        setLocalRate(data.rates.GTQ);
        setExchangeRate(data.rates.GTQ);
        showToast("¡Cambio actualizado de internet! 🌐");
      }
    } catch (e) {
      alert("Error al actualizar. Se mantendrá el valor guardado.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#FBCFE8]">
        <h3 className="font-black text-xl text-[#9F1239] mb-2 flex items-center gap-2">
          <Settings size={20} className="text-[#F472B6]" />
          Moneda y Cambio
        </h3>
        <p className="text-sm text-[#FB7185] font-bold mb-6">Ajusta el valor de conversión entre Pesos Mexicanos (MXN) y Quetzales (GTQ).</p>
        
        <div className="space-y-5">
          <label className="block text-sm font-black text-[#831843]">1 Peso Mexicano (MXN) equivale a (GTQ):</label>
          <input 
            type="number" step="0.01" value={localRate} 
            onChange={(e) => setLocalRate(parseFloat(e.target.value))}
            className="w-full p-5 rounded-2xl bg-[#FFF0F5] border-2 border-transparent text-2xl font-black outline-none focus:border-[#F472B6] text-[#831843]" 
          />
          
          <div className="flex gap-3">
             <button 
               onClick={() => { setExchangeRate(localRate); showToast("¡Ajuste guardado! ⚙️"); }} 
               className="flex-1 bg-[#F472B6] text-white py-4 rounded-2xl font-black active:scale-95 shadow-md"
             >
               Guardar Manual
             </button>
             <button 
               onClick={fetchApiRate} disabled={loading}
               className="flex-1 bg-[#FBCFE8] text-[#9F1239] py-4 rounded-2xl font-black active:scale-95 disabled:opacity-50"
             >
               {loading ? 'Buscando...' : 'Obtener de API'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
